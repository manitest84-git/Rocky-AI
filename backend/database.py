import os
import logging
import asyncpg
import json
from typing import List, Dict, Any, Optional
from datetime import datetime, date

def _parse_dt(val: Any) -> Optional[datetime]:
    if not val:
        return None
    if isinstance(val, datetime):
        return val
    if isinstance(val, str):
        try:
            return datetime.fromisoformat(val.replace('Z', '+00:00'))
        except Exception:
            return None
    return None

def _parse_date(val: Any) -> Optional[date]:
    if not val:
        return None
    if isinstance(val, date):
        return val
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, str):
        try:
            return date.fromisoformat(val[:10])
        except Exception:
            return None
    return None

"""
Rocky AI Platform — PostgreSQL Database Layer

Manages all database schema initialization, CRUD operations, and query helpers
for users, conversations, tasks, notes, calendar events, financial transactions,
subscriptions, shopping lists, smart home devices, and automation routines.

All operations use asyncpg connection pooling for high-performance async I/O.
"""

logger = logging.getLogger(__name__)

PG_HOST = os.getenv("POSTGRES_HOST", "postgres")
PG_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
PG_DB = os.getenv("POSTGRES_DB", "rocky_db")
PG_USER = os.getenv("POSTGRES_USER", "rocky_admin")
PG_PASS = os.getenv("POSTGRES_PASSWORD", "rocky_password")

pool: Optional[asyncpg.Pool] = None

async def get_pg_pool() -> asyncpg.Pool:
    global pool
    if pool is None:
        pool = await asyncpg.create_pool(
            host=PG_HOST,
            port=PG_PORT,
            database=PG_DB,
            user=PG_USER,
            password=PG_PASS,
            min_size=1,
            max_size=5
        )
    return pool

async def init_db():
    """Initialize PostgreSQL tables (users, conversations, pgvector documents, vault, triggers)."""
    try:
        p = await get_pg_pool()
        async with p.acquire() as conn:
            # Enable pgvector extension
            await conn.execute("CREATE EXTENSION IF NOT EXISTS vector;")

            # 1. Users Table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    role VARCHAR(50) NOT NULL DEFAULT 'user',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # 2. Conversations Table (Isolated per user)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    role VARCHAR(50) NOT NULL,
                    content TEXT NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # 3. User Personal Documents / RAG Table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS user_documents (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    embedding vector(1536),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # 4. Critical Vault Table (Owner or Admin access)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS critical_vault (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    data_category VARCHAR(255) NOT NULL,
                    encrypted_value TEXT NOT NULL,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # 5. Reminders, Alerts & Triggers Table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS reminders_triggers (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    title TEXT NOT NULL,
                    description TEXT,
                    trigger_type VARCHAR(50) NOT NULL DEFAULT 'reminder',
                    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    is_completed BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # 6. Tasks & To-Do List Table (Sprint 1)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS user_tasks (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    priority VARCHAR(10) DEFAULT 'P3',
                    category VARCHAR(100) DEFAULT 'General',
                    due_date TIMESTAMP WITH TIME ZONE,
                    is_completed BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # 7. Quick Capture Notes Table (Sprint 1)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS user_notes (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    title VARCHAR(255) NOT NULL,
                    content TEXT NOT NULL,
                    tags TEXT[],
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # 8. Calendar Events & Meetings Table (Sprint 2)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS calendar_events (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    location VARCHAR(255),
                    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
                    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
                    attendees TEXT[],
                    agenda TEXT,
                    action_items JSONB DEFAULT '[]'::jsonb,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # 9. Financial Transactions Table (Sprint 3)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS financial_transactions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    type VARCHAR(20) NOT NULL DEFAULT 'expense',
                    category VARCHAR(100) NOT NULL DEFAULT 'General',
                    amount NUMERIC(12,2) NOT NULL,
                    merchant VARCHAR(255),
                    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # 10. Subscriptions & Bill Reminders Table (Sprint 3)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS user_subscriptions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    service_name VARCHAR(255) NOT NULL,
                    billing_cycle VARCHAR(50) NOT NULL DEFAULT 'monthly',
                    amount NUMERIC(12,2) NOT NULL,
                    next_billing_date DATE NOT NULL,
                    category VARCHAR(100) DEFAULT 'Subscription',
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # 11. Shopping List Items Table (Sprint 3)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS shopping_items (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    item_name VARCHAR(255) NOT NULL,
                    quantity INTEGER DEFAULT 1,
                    category VARCHAR(100) DEFAULT 'General',
                    purchased BOOLEAN DEFAULT FALSE,
                    warranty_expiry DATE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # 12. Smart Home Devices Table (Sprint 5)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS smart_home_devices (
                    id SERIAL PRIMARY KEY,
                    device_name VARCHAR(255) NOT NULL,
                    device_type VARCHAR(100) NOT NULL,
                    room VARCHAR(100) NOT NULL,
                    is_on BOOLEAN DEFAULT FALSE,
                    settings JSONB DEFAULT '{}'::jsonb,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # 13. Automation Routines Table (Sprint 5)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS automation_routines (
                    id SERIAL PRIMARY KEY,
                    routine_name VARCHAR(255) NOT NULL,
                    icon VARCHAR(50) DEFAULT 'zap',
                    description TEXT,
                    actions JSONB NOT NULL DEFAULT '[]'::jsonb,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # Seed default smart home devices and routines if empty
            dev_count = await conn.fetchval("SELECT COUNT(*) FROM smart_home_devices;")
            if dev_count == 0:
                await conn.execute("""
                    INSERT INTO smart_home_devices (device_name, device_type, room, is_on, settings) VALUES
                    ('Living Room Main Lights', 'light', 'Living Room', true, '{"brightness": 80, "color": "warm_white"}'::jsonb),
                    ('Primary HVAC Thermostat', 'thermostat', 'Entire Home', true, '{"temperature": 22, "mode": "cool"}'::jsonb),
                    ('Main Entrance Smart Lock', 'lock', 'Entrance', true, '{"auto_lock": true}'::jsonb),
                    ('Studio Ambient LED Strip', 'light', 'Office', false, '{"brightness": 100, "color": "cyan"}'::jsonb),
                    ('HEPA Air Purifier Pro', 'purifier', 'Bedroom', true, '{"fan_speed": "auto", "aqi": 12}'::jsonb),
                    ('Perimeter Security Cameras', 'camera', 'Outdoor', true, '{"recording": true, "motion_detect": true}'::jsonb);
                """)

            rt_count = await conn.fetchval("SELECT COUNT(*) FROM automation_routines;")
            if rt_count == 0:
                await conn.execute("""
                    INSERT INTO automation_routines (routine_name, icon, description, actions) VALUES
                    ('Good Morning', 'sun', 'Activates morning lights, sets HVAC to 23°C, unlocks interior, turns on air purifier.', '[{"device_name": "Living Room Main Lights", "state": true, "settings": {"brightness": 100}}, {"device_name": "Primary HVAC Thermostat", "state": true, "settings": {"temperature": 23, "mode": "cool"}}, {"device_name": "Studio Ambient LED Strip", "state": true, "settings": {"brightness": 75}}]'::jsonb),
                    ('Good Night', 'moon', 'Dims all interior lights, locks main entrance, sets HVAC night mode.', '[{"device_name": "Living Room Main Lights", "state": false}, {"device_name": "Studio Ambient LED Strip", "state": false}, {"device_name": "Main Entrance Smart Lock", "state": true}, {"device_name": "Primary HVAC Thermostat", "state": true, "settings": {"temperature": 21, "mode": "eco"}}]'::jsonb),
                    ('Cyber Focus Mode', 'cpu', 'Sets studio lighting to Sci-Fi Cyan, turns off main living room lights.', '[{"device_name": "Living Room Main Lights", "state": false}, {"device_name": "Studio Ambient LED Strip", "state": true, "settings": {"brightness": 100, "color": "cyan"}}]'::jsonb),
                    ('Security Lockdown', 'shield', 'Arms perimeter cameras, locks entrance, turns on outdoor floodlights.', '[{"device_name": "Main Entrance Smart Lock", "state": true}, {"device_name": "Perimeter Security Cameras", "state": true, "settings": {"motion_detect": true}}]'::jsonb);
                """)

            # Seed default admin user if users table is empty
            count = await conn.fetchval("SELECT COUNT(*) FROM users;")
            if count == 0:
                from auth import hash_password
                default_admin_pass = hash_password("adminpassword")
                await conn.execute(
                    "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3);",
                    "admin", default_admin_pass, "admin"
                )
                logger.info("PostgreSQL DB initialized. Default admin user created (admin / adminpassword).")

        logger.info("PostgreSQL + pgvector schema initialized successfully.")
    except Exception as e:
        logger.error(f"PostgreSQL initialization error: {e}")

# User operations
async def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM users WHERE username = $1;", username)
        return dict(row) if row else None

async def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        row = await conn.fetchrow("SELECT id, username, role, created_at FROM users WHERE id = $1;", user_id)
        return dict(row) if row else None

async def get_all_users() -> List[Dict[str, Any]]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        rows = await conn.fetch("SELECT id, username, role, created_at FROM users ORDER BY id ASC;")
        return [dict(r) for r in rows]

async def create_user(username: str, password_hash: str, role: str = "user") -> Dict[str, Any]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role;",
            username, password_hash, role
        )
        return dict(row)

async def delete_user(user_id: int) -> bool:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        user = await conn.fetchrow("SELECT username FROM users WHERE id = $1;", user_id)
        if user and user["username"] == "admin":
            return False
        await conn.execute("DELETE FROM users WHERE id = $1;", user_id)
        return True

async def update_user_password(user_id: int, new_password_hash: str) -> bool:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        res = await conn.execute(
            "UPDATE users SET password_hash = $1 WHERE id = $2;",
            new_password_hash, user_id
        )
        return "UPDATE 1" in res

# Conversation operations
async def save_conversation_turn(user_id: int, role: str, content: str):
    p = await get_pg_pool()
    async with p.acquire() as conn:
        await conn.execute(
            "INSERT INTO conversations (user_id, role, content) VALUES ($1, $2, $3);",
            user_id, role, content
        )

async def get_user_conversation_history(user_id: int, limit: int = 10, offset: int = 0) -> Dict[str, Any]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        total_count = await conn.fetchval("SELECT COUNT(*) FROM conversations WHERE user_id = $1;", user_id)
        rows = await conn.fetch(
            """
            SELECT role, content, timestamp FROM (
                SELECT role, content, timestamp, id 
                FROM conversations 
                WHERE user_id = $1 
                ORDER BY id DESC 
                LIMIT $2 OFFSET $3
            ) sub ORDER BY id ASC;
            """,
            user_id, limit, offset
        )
        messages = [{"role": r["role"], "content": r["content"], "timestamp": str(r["timestamp"])} for r in rows]
        has_more = (offset + limit) < total_count
        return {
            "messages": messages,
            "total_count": total_count,
            "has_more": has_more,
            "offset": offset,
            "limit": limit
        }

async def clear_user_conversation_history(user_id: int):
    p = await get_pg_pool()
    async with p.acquire() as conn:
        await conn.execute("DELETE FROM conversations WHERE user_id = $1;", user_id)

# Vault operations
async def save_vault_item(user_id: int, category: str, encrypted_value: str, notes: str = "") -> Dict[str, Any]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO critical_vault (user_id, data_category, encrypted_value, notes)
            VALUES ($1, $2, $3, $4)
            RETURNING id, user_id, data_category, notes, created_at;
            """,
            user_id, category, encrypted_value, notes
        )
        return dict(row)

async def get_vault_items(user_id: int, is_admin: bool = False) -> List[Dict[str, Any]]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        if is_admin:
            rows = await conn.fetch("SELECT id, user_id, data_category, encrypted_value, notes, created_at FROM critical_vault ORDER BY id DESC;")
        else:
            rows = await conn.fetch("SELECT id, user_id, data_category, encrypted_value, notes, created_at FROM critical_vault WHERE user_id = $1 ORDER BY id DESC;", user_id)
        return [dict(r) for r in rows]

async def delete_vault_item(item_id: int, user_id: int, is_admin: bool = False) -> bool:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        if is_admin:
            res = await conn.execute("DELETE FROM critical_vault WHERE id = $1;", item_id)
        else:
            res = await conn.execute("DELETE FROM critical_vault WHERE id = $1 AND user_id = $2;", item_id, user_id)
        return "DELETE 1" in res

# Reminders & Triggers operations
async def create_reminder(user_id: int, title: str, scheduled_at: str, description: str = "", trigger_type: str = "reminder") -> Dict[str, Any]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO reminders_triggers (user_id, title, description, trigger_type, scheduled_at)
            VALUES ($1, $2, $3, $4, $5::timestamp with time zone)
            RETURNING id, user_id, title, description, trigger_type, scheduled_at, is_completed;
            """,
            user_id, title, description, trigger_type, scheduled_at
        )
        return dict(row)

async def get_user_reminders(user_id: int, is_admin: bool = False) -> List[Dict[str, Any]]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        if is_admin:
            rows = await conn.fetch("SELECT * FROM reminders_triggers ORDER BY scheduled_at ASC;")
        else:
            rows = await conn.fetch("SELECT * FROM reminders_triggers WHERE user_id = $1 ORDER BY scheduled_at ASC;", user_id)
        return [dict(r) for r in rows]

# Tasks CRUD operations (Sprint 1)
async def create_task(user_id: int, title: str, description: str = "", priority: str = "P3", category: str = "General", due_date: Optional[str] = None) -> Dict[str, Any]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        dt = _parse_dt(due_date)
        if dt:
            row = await conn.fetchrow(
                """
                INSERT INTO user_tasks (user_id, title, description, priority, category, due_date)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, user_id, title, description, priority, category, due_date, is_completed, created_at;
                """,
                user_id, title, description, priority, category, dt
            )
        else:
            row = await conn.fetchrow(
                """
                INSERT INTO user_tasks (user_id, title, description, priority, category)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, user_id, title, description, priority, category, due_date, is_completed, created_at;
                """,
                user_id, title, description, priority, category
            )
        return dict(row)

async def get_user_tasks(user_id: int, is_admin: bool = False) -> List[Dict[str, Any]]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        if is_admin:
            rows = await conn.fetch("SELECT * FROM user_tasks ORDER BY is_completed ASC, priority ASC, id DESC;")
        else:
            rows = await conn.fetch("SELECT * FROM user_tasks WHERE user_id = $1 ORDER BY is_completed ASC, priority ASC, id DESC;", user_id)
        return [dict(r) for r in rows]

async def toggle_task_completion(task_id: int, user_id: int, is_admin: bool = False) -> Optional[Dict[str, Any]]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        if is_admin:
            row = await conn.fetchrow(
                "UPDATE user_tasks SET is_completed = NOT is_completed WHERE id = $1 RETURNING id, title, is_completed;",
                task_id
            )
        else:
            row = await conn.fetchrow(
                "UPDATE user_tasks SET is_completed = NOT is_completed WHERE id = $1 AND user_id = $2 RETURNING id, title, is_completed;",
                task_id, user_id
            )
        return dict(row) if row else None

async def delete_task(task_id: int, user_id: int, is_admin: bool = False) -> bool:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        if is_admin:
            res = await conn.execute("DELETE FROM user_tasks WHERE id = $1;", task_id)
        else:
            res = await conn.execute("DELETE FROM user_tasks WHERE id = $1 AND user_id = $2;", task_id, user_id)
        return "DELETE 1" in res

# Quick Notes operations (Sprint 1)
async def create_note(user_id: int, title: str, content: str, tags: List[str] = None) -> Dict[str, Any]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO user_notes (user_id, title, content, tags)
            VALUES ($1, $2, $3, $4)
            RETURNING id, user_id, title, content, tags, created_at;
            """,
            user_id, title, content, tags or []
        )
        return dict(row)

async def get_user_notes(user_id: int) -> List[Dict[str, Any]]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM user_notes WHERE user_id = $1 ORDER BY id DESC;", user_id)
        return [dict(r) for r in rows]

# Calendar & Meetings operations (Sprint 2)
async def create_calendar_event(
    user_id: int, title: str, start_time: str, end_time: str,
    description: str = "", location: str = "", attendees: List[str] = None,
    agenda: str = ""
) -> Dict[str, Any]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        st_dt = _parse_dt(start_time)
        et_dt = _parse_dt(end_time)
        row = await conn.fetchrow(
            """
            INSERT INTO calendar_events (user_id, title, description, location, start_time, end_time, attendees, agenda)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, user_id, title, description, location, start_time, end_time, attendees, agenda, action_items, created_at;
            """,
            user_id, title, description, location, st_dt, et_dt, attendees or [], agenda
        )
        return dict(row)

async def check_scheduling_conflicts(user_id: int, start_time: str, end_time: str, exclude_event_id: Optional[int] = None) -> List[Dict[str, Any]]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        st_dt = _parse_dt(start_time)
        et_dt = _parse_dt(end_time)
        if exclude_event_id:
            rows = await conn.fetch(
                """
                SELECT id, title, start_time, end_time FROM calendar_events
                WHERE user_id = $1 AND id != $2
                AND (start_time < $4 AND end_time > $3);
                """,
                user_id, exclude_event_id, st_dt, et_dt
            )
        else:
            rows = await conn.fetch(
                """
                SELECT id, title, start_time, end_time FROM calendar_events
                WHERE user_id = $1
                AND (start_time < $3 AND end_time > $2);
                """,
                user_id, st_dt, et_dt
            )
        return [dict(r) for r in rows]

async def get_user_calendar_events(user_id: int) -> List[Dict[str, Any]]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM calendar_events WHERE user_id = $1 ORDER BY start_time ASC;", user_id)
        return [dict(r) for r in rows]

async def update_calendar_event(event_id: int, user_id: int, agenda: Optional[str] = None, action_items: Optional[List[Dict[str, Any]]] = None) -> Optional[Dict[str, Any]]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        if agenda is not None:
            await conn.execute("UPDATE calendar_events SET agenda = $1 WHERE id = $2 AND user_id = $3;", agenda, event_id, user_id)
        if action_items is not None:
            await conn.execute("UPDATE calendar_events SET action_items = $1::jsonb WHERE id = $2 AND user_id = $3;", json.dumps(action_items), event_id, user_id)
        row = await conn.fetchrow("SELECT * FROM calendar_events WHERE id = $1 AND user_id = $2;", event_id, user_id)
        return dict(row) if row else None

async def delete_calendar_event(event_id: int, user_id: int) -> bool:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        res = await conn.execute("DELETE FROM calendar_events WHERE id = $1 AND user_id = $2;", event_id, user_id)
        return "DELETE 1" in res

# Finance & Personal Money Management Operations (Sprint 3)
async def create_financial_transaction(
    user_id: int, type: str, category: str, amount: float,
    merchant: str = "", transaction_date: str = None, notes: str = ""
) -> Dict[str, Any]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        dt = _parse_date(transaction_date)
        if dt:
            row = await conn.fetchrow(
                """
                INSERT INTO financial_transactions (user_id, type, category, amount, merchant, transaction_date, notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id, user_id, type, category, amount, merchant, transaction_date, notes, created_at;
                """,
                user_id, type, category, amount, merchant, dt, notes
            )
        else:
            row = await conn.fetchrow(
                """
                INSERT INTO financial_transactions (user_id, type, category, amount, merchant, notes)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, user_id, type, category, amount, merchant, transaction_date, notes, created_at;
                """,
                user_id, type, category, amount, merchant, notes
            )
        res = dict(row)
        res["amount"] = float(res["amount"])
        return res

async def get_user_financial_transactions(user_id: int) -> List[Dict[str, Any]]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM financial_transactions WHERE user_id = $1 ORDER BY transaction_date DESC, id DESC;", user_id)
        result = []
        for r in rows:
            d = dict(r)
            d["amount"] = float(d["amount"])
            result.append(d)
        return result

async def delete_financial_transaction(tx_id: int, user_id: int) -> bool:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        res = await conn.execute("DELETE FROM financial_transactions WHERE id = $1 AND user_id = $2;", tx_id, user_id)
        return "DELETE 1" in res

async def get_finance_summary(user_id: int) -> Dict[str, Any]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        rows = await conn.fetch("SELECT type, category, amount FROM financial_transactions WHERE user_id = $1;", user_id)
        total_income = 0.0
        total_expense = 0.0
        categories: Dict[str, float] = {}

        for r in rows:
            amt = float(r["amount"])
            if r["type"] == "income":
                total_income += amt
            else:
                total_expense += amt
                cat = r["category"] or "General"
                categories[cat] = categories.get(cat, 0.0) + amt

        return {
            "total_income": total_income,
            "total_expense": total_expense,
            "net_savings": total_income - total_expense,
            "category_breakdown": categories
        }

# Subscriptions Operations (Sprint 3)
async def create_subscription(
    user_id: int, service_name: str, amount: float, next_billing_date: str,
    billing_cycle: str = "monthly", category: str = "Subscription"
) -> Dict[str, Any]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        dt = _parse_date(next_billing_date)
        row = await conn.fetchrow(
            """
            INSERT INTO user_subscriptions (user_id, service_name, billing_cycle, amount, next_billing_date, category)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, user_id, service_name, billing_cycle, amount, next_billing_date, category, is_active, created_at;
            """,
            user_id, service_name, billing_cycle, amount, dt, category
        )
        res = dict(row)
        res["amount"] = float(res["amount"])
        return res

async def get_user_subscriptions(user_id: int) -> List[Dict[str, Any]]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM user_subscriptions WHERE user_id = $1 ORDER BY next_billing_date ASC;", user_id)
        result = []
        for r in rows:
            d = dict(r)
            d["amount"] = float(d["amount"])
            result.append(d)
        return result

async def delete_subscription(sub_id: int, user_id: int) -> bool:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        res = await conn.execute("DELETE FROM user_subscriptions WHERE id = $1 AND user_id = $2;", sub_id, user_id)
        return "DELETE 1" in res

# Shopping List Operations (Sprint 3)
async def create_shopping_item(
    user_id: int, item_name: str, quantity: int = 1, category: str = "General", warranty_expiry: Optional[str] = None
) -> Dict[str, Any]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        dt = _parse_date(warranty_expiry)
        if dt:
            row = await conn.fetchrow(
                """
                INSERT INTO shopping_items (user_id, item_name, quantity, category, warranty_expiry)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, user_id, item_name, quantity, category, purchased, warranty_expiry, created_at;
                """,
                user_id, item_name, quantity, category, dt
            )
        else:
            row = await conn.fetchrow(
                """
                INSERT INTO shopping_items (user_id, item_name, quantity, category)
                VALUES ($1, $2, $3, $4)
                RETURNING id, user_id, item_name, quantity, category, purchased, warranty_expiry, created_at;
                """,
                user_id, item_name, quantity, category
            )
        return dict(row)

async def get_user_shopping_items(user_id: int) -> List[Dict[str, Any]]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM shopping_items WHERE user_id = $1 ORDER BY purchased ASC, id DESC;", user_id)
        return [dict(r) for r in rows]

async def toggle_shopping_item(item_id: int, user_id: int) -> Optional[Dict[str, Any]]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        row = await conn.fetchrow(
            """
            UPDATE shopping_items 
            SET purchased = NOT purchased 
            WHERE id = $1 AND user_id = $2
            RETURNING id, item_name, purchased;
            """,
            item_id, user_id
        )
        return dict(row) if row else None

async def delete_shopping_item(item_id: int, user_id: int) -> bool:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        res = await conn.execute("DELETE FROM shopping_items WHERE id = $1 AND user_id = $2;", item_id, user_id)
        return "DELETE 1" in res

# Smart Home Operations (Sprint 5)
async def get_all_smart_home_devices() -> List[Dict[str, Any]]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM smart_home_devices ORDER BY room ASC, device_name ASC;")
        res = []
        for r in rows:
            d = dict(r)
            if isinstance(d.get("settings"), str):
                d["settings"] = json.loads(d["settings"])
            res.append(d)
        return res

async def update_smart_home_device(device_id: int, is_on: Optional[bool] = None, settings: Optional[dict] = None) -> Optional[Dict[str, Any]]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        if is_on is not None and settings is not None:
            row = await conn.fetchrow(
                "UPDATE smart_home_devices SET is_on = $1, settings = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *;",
                is_on, json.dumps(settings), device_id
            )
        elif is_on is not None:
            row = await conn.fetchrow(
                "UPDATE smart_home_devices SET is_on = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *;",
                is_on, device_id
            )
        elif settings is not None:
            row = await conn.fetchrow(
                "UPDATE smart_home_devices SET settings = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *;",
                json.dumps(settings), device_id
            )
        else:
            row = await conn.fetchrow("SELECT * FROM smart_home_devices WHERE id = $1;", device_id)
        
        if not row:
            return None
        d = dict(row)
        if isinstance(d.get("settings"), str):
            d["settings"] = json.loads(d["settings"])
        return d

async def get_all_automation_routines() -> List[Dict[str, Any]]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM automation_routines ORDER BY id ASC;")
        res = []
        for r in rows:
            d = dict(r)
            if isinstance(d.get("actions"), str):
                d["actions"] = json.loads(d["actions"])
            res.append(d)
        return res

async def execute_automation_routine(routine_id: int) -> Dict[str, Any]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        routine_row = await conn.fetchrow("SELECT * FROM automation_routines WHERE id = $1;", routine_id)
        if not routine_row:
            return {"status": "error", "message": "Routine not found"}
        
        routine = dict(routine_row)
        actions = routine.get("actions", [])
        if isinstance(actions, str):
            actions = json.loads(actions)
            
        executed_count = 0
        for act in actions:
            dev_name = act.get("device_name")
            target_state = act.get("state")
            target_settings = act.get("settings")
            
            if dev_name and target_state is not None:
                if target_settings:
                    await conn.execute(
                        "UPDATE smart_home_devices SET is_on = $1, settings = settings || $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE device_name = $3;",
                        target_state, json.dumps(target_settings), dev_name
                    )
                else:
                    await conn.execute(
                        "UPDATE smart_home_devices SET is_on = $1, updated_at = CURRENT_TIMESTAMP WHERE device_name = $2;",
                        target_state, dev_name
                    )
                executed_count += 1
                
        return {
            "status": "success",
            "routine_name": routine.get("routine_name"),
            "actions_executed": executed_count
        }


