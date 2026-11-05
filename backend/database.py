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

async def seed_default_llm_configuration(conn):
    """Seed system default Local Ollama provider and map 8 default feature routes if empty."""
    provider_count = await conn.fetchval("SELECT COUNT(*) FROM llm_providers;")
    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
    ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5:1.5b")

    if provider_count == 0:
        await conn.execute("""
            INSERT INTO llm_providers (name, provider_type, base_url, default_model, timeout_seconds, is_system, is_active)
            VALUES ($1, $2, $3, $4, 60, TRUE, TRUE);
        """, "Local Ollama", "ollama", ollama_url, ollama_model)

    default_provider_id = await conn.fetchval("SELECT id FROM llm_providers WHERE is_system = TRUE LIMIT 1;")
    if not default_provider_id:
        default_provider_id = await conn.fetchval("SELECT id FROM llm_providers ORDER BY id ASC LIMIT 1;")

    if default_provider_id:
        default_features = [
            ("voice_agent", "Real-Time Voice Assistant Dialogue", "Low-latency conversational voice agent streaming audio in WebRTC sessions via LiveKit"),
            ("chat_text", "Interactive Text Chat & Terminal", "Streaming text chat responses over SSE and WebSockets in the HUD interface"),
            ("intent_action_dispatch", "Intent Parsing & Action Dispatch", "Natural language extraction for creating tasks, reminders, calendar entries, and smart home actions"),
            ("hitl_safety_guardrail", "Human-in-the-Loop Safety Analysis", "Evaluates high-risk destructive operations (file deletion, terminal execution) before staging"),
            ("memory_extraction", "Long-Term Memory & User Facts", "Extracts personal preferences, facts, and habits from conversation history into pgvector via Mem0"),
            ("calendar_agenda_generation", "Meeting Agenda & Brief Synthesis", "Generates structured meeting agendas, objectives, and discussion points"),
            ("daily_briefing_synthesis", "Executive Morning Daily Briefing", "Synthesizes weather, schedule, reminders, and news into a cohesive daily summary"),
            ("study_matrix_quiz", "Study Matrix AI Quiz & Explanations", "Generates interactive multiple-choice quizzes, answer explanations, and concept drill cards")
        ]

        for key, name, desc in default_features:
            await conn.execute("""
                INSERT INTO llm_feature_routes (feature_key, feature_name, description, primary_provider_id, primary_model)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (feature_key) DO NOTHING;
            """, key, name, desc, default_provider_id, ollama_model)

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
                    recurrence_rule VARCHAR(100) DEFAULT 'NONE',
                    category VARCHAR(50) DEFAULT 'Work',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS recurrence_rule VARCHAR(100) DEFAULT 'NONE';
                ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'Work';

                -- User Autonomous Memories & Preferences
                CREATE TABLE IF NOT EXISTS user_memories (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    fact TEXT NOT NULL,
                    category VARCHAR(50) DEFAULT 'preference',
                    confidence FLOAT DEFAULT 1.0,
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

            # 14. LLM Providers Table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS llm_providers (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) UNIQUE NOT NULL,
                    provider_type VARCHAR(50) NOT NULL,
                    base_url TEXT NOT NULL,
                    api_key_encrypted TEXT NULL,
                    default_model VARCHAR(100) NOT NULL,
                    available_models JSONB DEFAULT '[]'::jsonb,
                    temperature NUMERIC(3, 2) DEFAULT 0.70,
                    max_tokens INTEGER DEFAULT 2048,
                    timeout_seconds INTEGER DEFAULT 30,
                    is_active BOOLEAN DEFAULT TRUE,
                    is_system BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # 15. LLM Feature Routes Table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS llm_feature_routes (
                    id SERIAL PRIMARY KEY,
                    feature_key VARCHAR(100) UNIQUE NOT NULL,
                    feature_name VARCHAR(150) NOT NULL,
                    description TEXT NOT NULL,
                    primary_provider_id INTEGER NOT NULL REFERENCES llm_providers(id) ON DELETE RESTRICT,
                    primary_model VARCHAR(100) NOT NULL,
                    fallback_provider_id INTEGER NULL REFERENCES llm_providers(id) ON DELETE SET NULL,
                    fallback_model VARCHAR(100) NULL,
                    system_prompt_override TEXT NULL,
                    temperature_override NUMERIC(3, 2) NULL,
                    max_tokens_override INTEGER NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # Seed default LLM providers and feature routes if empty
            await seed_default_llm_configuration(conn)

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

async def get_user_conversation_history(user_id: int, limit: int = 10, offset: int = 0, today_only: bool = False) -> Dict[str, Any]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        date_clause = "AND timestamp::date = CURRENT_DATE" if today_only else ""
        total_count = await conn.fetchval(f"SELECT COUNT(*) FROM conversations WHERE user_id = $1 {date_clause};", user_id)
        all_time_count = await conn.fetchval("SELECT COUNT(*) FROM conversations WHERE user_id = $1;", user_id)
        rows = await conn.fetch(
            f"""
            SELECT role, content, timestamp FROM (
                SELECT role, content, timestamp, id 
                FROM conversations 
                WHERE user_id = $1 {date_clause}
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
            "all_time_count": all_time_count,
            "today_only": today_only,
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
        dt = _parse_dt(scheduled_at) or datetime.now()
        row = await conn.fetchrow(
            """
            INSERT INTO reminders_triggers (user_id, title, description, trigger_type, scheduled_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, user_id, title, description, trigger_type, scheduled_at, is_completed;
            """,
            user_id, title, description, trigger_type, dt
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
    agenda: str = "", recurrence_rule: str = "NONE", category: str = "Work"
) -> Dict[str, Any]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        st_dt = _parse_dt(start_time)
        et_dt = _parse_dt(end_time)
        row = await conn.fetchrow(
            """
            INSERT INTO calendar_events (user_id, title, description, location, start_time, end_time, attendees, agenda, recurrence_rule, category)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, user_id, title, description, location, start_time, end_time, attendees, agenda, action_items, recurrence_rule, category, created_at;
            """,
            user_id, title, description, location, st_dt, et_dt, attendees or [], agenda, recurrence_rule or "NONE", category or "Work"
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

# User Autonomous Memories & Preferences
async def add_user_memory(user_id: int, fact: str, category: str = "preference", confidence: float = 1.0) -> Dict[str, Any]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO user_memories (user_id, fact, category, confidence)
            VALUES ($1, $2, $3, $4)
            RETURNING id, user_id, fact, category, confidence, created_at;
            """,
            user_id, fact, category, confidence
        )
        return dict(row)

async def get_user_memories(user_id: int) -> List[Dict[str, Any]]:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM user_memories WHERE user_id = $1 ORDER BY created_at DESC;",
            user_id
        )
        return [dict(r) for r in rows]

async def delete_user_memory(user_id: int, memory_id: int) -> bool:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        res = await conn.execute(
            "DELETE FROM user_memories WHERE id = $1 AND user_id = $2;",
            memory_id, user_id
        )
        return "DELETE 1" in res

async def purge_user_memories(user_id: int) -> bool:
    p = await get_pg_pool()
    async with p.acquire() as conn:
        await conn.execute("DELETE FROM user_memories WHERE user_id = $1;", user_id)
        return True

# ------------------------------------------------------------------------------
# LLM Providers & Cognitive Routing
# ------------------------------------------------------------------------------

async def get_all_llm_providers(include_keys: bool = False) -> List[Dict[str, Any]]:
    """Retrieve all configured LLM providers with masked or decrypted API keys."""
    p = await get_pg_pool()
    async with p.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM llm_providers ORDER BY is_system DESC, id ASC;")
        results = []
        for r in rows:
            d = dict(r)
            if d.get("available_models") and isinstance(d["available_models"], str):
                try:
                    d["available_models"] = json.loads(d["available_models"])
                except Exception:
                    pass
            if d.get("api_key_encrypted"):
                from security import decrypt_vault_data, mask_api_key
                decrypted = decrypt_vault_data(d["api_key_encrypted"])
                d["api_key"] = decrypted if include_keys else mask_api_key(decrypted)
                d["has_api_key"] = bool(decrypted and not decrypted.startswith("["))
            else:
                d["api_key"] = ""
                d["has_api_key"] = False
            del d["api_key_encrypted"]
            results.append(d)
        return results

async def get_llm_provider_by_id(provider_id: int, include_key: bool = False) -> Optional[Dict[str, Any]]:
    """Retrieve an LLM provider by ID."""
    p = await get_pg_pool()
    async with p.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM llm_providers WHERE id = $1;", provider_id)
        if not row:
            return None
        d = dict(row)
        if d.get("available_models") and isinstance(d["available_models"], str):
            try:
                d["available_models"] = json.loads(d["available_models"])
            except Exception:
                pass
        if d.get("api_key_encrypted"):
            from security import decrypt_vault_data, mask_api_key
            decrypted = decrypt_vault_data(d["api_key_encrypted"])
            d["api_key"] = decrypted if include_key else mask_api_key(decrypted)
            d["has_api_key"] = bool(decrypted and not decrypted.startswith("["))
        else:
            d["api_key"] = ""
            d["has_api_key"] = False
        del d["api_key_encrypted"]
        return d

async def create_llm_provider(
    name: str,
    provider_type: str,
    base_url: str,
    default_model: str,
    api_key: Optional[str] = None,
    available_models: Optional[List[str]] = None,
    temperature: float = 0.7,
    max_tokens: int = 2048,
    timeout_seconds: int = 30,
    is_active: bool = True
) -> Dict[str, Any]:
    """Create a new LLM provider with encrypted API key storage."""
    from security import encrypt_vault_data, mask_api_key
    enc_key = encrypt_vault_data(api_key.strip()) if (api_key and api_key.strip()) else None
    models_json = json.dumps(available_models or [])

    p = await get_pg_pool()
    async with p.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO llm_providers (
                name, provider_type, base_url, api_key_encrypted, default_model,
                available_models, temperature, max_tokens, timeout_seconds, is_active, is_system
            )
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, FALSE)
            RETURNING *;
            """,
            name.strip(), provider_type.strip().lower(), base_url.strip(), enc_key, default_model.strip(),
            models_json, temperature, max_tokens, timeout_seconds, is_active
        )
        d = dict(row)
        if d.get("available_models") and isinstance(d["available_models"], str):
            try:
                d["available_models"] = json.loads(d["available_models"])
            except Exception:
                pass
        d["api_key"] = mask_api_key(api_key) if api_key else ""
        d["has_api_key"] = bool(enc_key)
        del d["api_key_encrypted"]
        return d

async def update_llm_provider(provider_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Update an existing LLM provider."""
    p = await get_pg_pool()
    async with p.acquire() as conn:
        existing = await conn.fetchrow("SELECT * FROM llm_providers WHERE id = $1;", provider_id)
        if not existing:
            return None

        from security import encrypt_vault_data, decrypt_vault_data, mask_api_key
        enc_key = existing["api_key_encrypted"]

        # Only update key if a new plain-text key is passed (not masked)
        if "api_key" in data and data["api_key"] is not None:
            raw_key = data["api_key"].strip()
            if "••••" not in raw_key:
                enc_key = encrypt_vault_data(raw_key) if raw_key else None

        name = data.get("name", existing["name"]).strip()
        provider_type = data.get("provider_type", existing["provider_type"]).strip().lower()
        base_url = data.get("base_url", existing["base_url"]).strip()
        default_model = data.get("default_model", existing["default_model"]).strip()
        temperature = float(data.get("temperature", existing["temperature"]))
        max_tokens = int(data.get("max_tokens", existing["max_tokens"]))
        timeout_seconds = int(data.get("timeout_seconds", existing["timeout_seconds"]))
        is_active = bool(data.get("is_active", existing["is_active"]))
        
        models_val = data.get("available_models")
        if models_val is not None:
            models_json_str = json.dumps(models_val)
        else:
            models_json_str = json.dumps(existing["available_models"]) if not isinstance(existing["available_models"], str) else existing["available_models"]

        row = await conn.fetchrow(
            """
            UPDATE llm_providers
            SET name = $1, provider_type = $2, base_url = $3, api_key_encrypted = $4,
                default_model = $5, available_models = $6::jsonb, temperature = $7,
                max_tokens = $8, timeout_seconds = $9, is_active = $10, updated_at = CURRENT_TIMESTAMP
            WHERE id = $11
            RETURNING *;
            """,
            name, provider_type, base_url, enc_key, default_model, models_json_str,
            temperature, max_tokens, timeout_seconds, is_active, provider_id
        )
        d = dict(row)
        if d.get("available_models") and isinstance(d["available_models"], str):
            try:
                d["available_models"] = json.loads(d["available_models"])
            except Exception:
                pass
        decrypted = decrypt_vault_data(enc_key) if enc_key else ""
        d["api_key"] = mask_api_key(decrypted)
        d["has_api_key"] = bool(decrypted and not decrypted.startswith("["))
        del d["api_key_encrypted"]
        return d

async def delete_llm_provider(provider_id: int) -> Dict[str, Any]:
    """Delete a custom LLM provider if not system and not in active use."""
    p = await get_pg_pool()
    async with p.acquire() as conn:
        existing = await conn.fetchrow("SELECT is_system FROM llm_providers WHERE id = $1;", provider_id)
        if not existing:
            return {"success": False, "error": "Provider not found"}
        if existing["is_system"]:
            return {"success": False, "error": "System default provider cannot be deleted"}

        in_use = await conn.fetch("SELECT feature_name FROM llm_feature_routes WHERE primary_provider_id = $1;", provider_id)
        if in_use:
            features = [r["feature_name"] for r in in_use]
            return {
                "success": False,
                "error": f"Cannot delete provider: It is currently active as the primary provider for: {', '.join(features)}. Please reassign those features first."
            }

        await conn.execute("DELETE FROM llm_providers WHERE id = $1;", provider_id)
        return {"success": True}

async def get_all_feature_routes(include_keys: bool = False) -> List[Dict[str, Any]]:
    """Retrieve all feature routes with primary and fallback provider details."""
    p = await get_pg_pool()
    async with p.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT 
                r.id,
                r.feature_key,
                r.feature_name,
                r.description,
                r.primary_provider_id,
                p1.name AS primary_provider_name,
                p1.provider_type AS primary_provider_type,
                p1.base_url AS primary_base_url,
                p1.api_key_encrypted AS primary_api_key_encrypted,
                r.primary_model,
                r.fallback_provider_id,
                p2.name AS fallback_provider_name,
                p2.provider_type AS fallback_provider_type,
                p2.base_url AS fallback_base_url,
                p2.api_key_encrypted AS fallback_api_key_encrypted,
                r.fallback_model,
                r.system_prompt_override,
                r.temperature_override,
                r.max_tokens_override,
                r.updated_at
            FROM llm_feature_routes r
            JOIN llm_providers p1 ON r.primary_provider_id = p1.id
            LEFT JOIN llm_providers p2 ON r.fallback_provider_id = p2.id
            ORDER BY r.id ASC;
            """
        )
        from security import decrypt_vault_data, mask_api_key
        results = []
        for row in rows:
            d = dict(row)
            if d.get("primary_api_key_encrypted"):
                dec = decrypt_vault_data(d["primary_api_key_encrypted"])
                d["primary_api_key"] = dec if include_keys else mask_api_key(dec)
            else:
                d["primary_api_key"] = ""
            del d["primary_api_key_encrypted"]

            if d.get("fallback_api_key_encrypted"):
                dec_fb = decrypt_vault_data(d["fallback_api_key_encrypted"])
                d["fallback_api_key"] = dec_fb if include_keys else mask_api_key(dec_fb)
            else:
                d["fallback_api_key"] = ""
            del d["fallback_api_key_encrypted"]

            results.append(d)
        return results

async def get_feature_route(feature_key: str, include_keys: bool = False) -> Optional[Dict[str, Any]]:
    """Retrieve a single feature route with full provider details."""
    p = await get_pg_pool()
    async with p.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT 
                r.id,
                r.feature_key,
                r.feature_name,
                r.description,
                r.primary_provider_id,
                p1.name AS primary_provider_name,
                p1.provider_type AS primary_provider_type,
                p1.base_url AS primary_base_url,
                p1.api_key_encrypted AS primary_api_key_encrypted,
                p1.temperature AS primary_default_temp,
                p1.max_tokens AS primary_default_max_tokens,
                p1.timeout_seconds AS primary_timeout_seconds,
                r.primary_model,
                r.fallback_provider_id,
                p2.name AS fallback_provider_name,
                p2.provider_type AS fallback_provider_type,
                p2.base_url AS fallback_base_url,
                p2.api_key_encrypted AS fallback_api_key_encrypted,
                p2.temperature AS fallback_default_temp,
                p2.max_tokens AS fallback_default_max_tokens,
                p2.timeout_seconds AS fallback_timeout_seconds,
                r.fallback_model,
                r.system_prompt_override,
                r.temperature_override,
                r.max_tokens_override,
                r.updated_at
            FROM llm_feature_routes r
            JOIN llm_providers p1 ON r.primary_provider_id = p1.id
            LEFT JOIN llm_providers p2 ON r.fallback_provider_id = p2.id
            WHERE r.feature_key = $1;
            """,
            feature_key
        )
        if not row:
            return None
        from security import decrypt_vault_data, mask_api_key
        d = dict(row)
        if d.get("primary_api_key_encrypted"):
            dec = decrypt_vault_data(d["primary_api_key_encrypted"])
            d["primary_api_key"] = dec if include_keys else mask_api_key(dec)
        else:
            d["primary_api_key"] = ""
        del d["primary_api_key_encrypted"]

        if d.get("fallback_api_key_encrypted"):
            dec_fb = decrypt_vault_data(d["fallback_api_key_encrypted"])
            d["fallback_api_key"] = dec_fb if include_keys else mask_api_key(dec_fb)
        else:
            d["fallback_api_key"] = ""
        del d["fallback_api_key_encrypted"]

        return d

async def update_feature_route(feature_key: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Update primary or fallback model/provider mapping for a feature route."""
    p = await get_pg_pool()
    async with p.acquire() as conn:
        existing = await conn.fetchrow("SELECT * FROM llm_feature_routes WHERE feature_key = $1;", feature_key)
        if not existing:
            return None

        primary_id = int(data.get("primary_provider_id", existing["primary_provider_id"]))
        primary_model = data.get("primary_model", existing["primary_model"]).strip()
        
        fallback_id = data.get("fallback_provider_id", existing["fallback_provider_id"])
        fallback_id = int(fallback_id) if (fallback_id is not None and str(fallback_id).strip() != "") else None

        fallback_model = data.get("fallback_model", existing["fallback_model"])
        fallback_model = fallback_model.strip() if (fallback_model and fallback_model.strip() != "") else None

        system_prompt = data.get("system_prompt_override", existing["system_prompt_override"])
        temp_override = data.get("temperature_override", existing["temperature_override"])
        temp_override = float(temp_override) if (temp_override is not None and str(temp_override).strip() != "") else None
        tokens_override = data.get("max_tokens_override", existing["max_tokens_override"])
        tokens_override = int(tokens_override) if (tokens_override is not None and str(tokens_override).strip() != "") else None

        await conn.execute(
            """
            UPDATE llm_feature_routes
            SET primary_provider_id = $1,
                primary_model = $2,
                fallback_provider_id = $3,
                fallback_model = $4,
                system_prompt_override = $5,
                temperature_override = $6,
                max_tokens_override = $7,
                updated_at = CURRENT_TIMESTAMP
            WHERE feature_key = $8;
            """,
            primary_id, primary_model, fallback_id, fallback_model,
            system_prompt, temp_override, tokens_override, feature_key
        )
        return await get_feature_route(feature_key)




