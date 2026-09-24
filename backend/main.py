import os
import json
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
import httpx

from livekit import api

from config import settings
from hitl import (
    stage_action as hitl_stage_action,
    get_action as hitl_get_action,
    get_pending_actions as hitl_get_pending_actions,
    confirm_action as hitl_confirm_action,
    reject_action as hitl_reject_action,
    detect_destructive_intent,
    HitLCategory,
    HitLStatus
)


# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Jarvis AI Backend")

from fastapi import Request
# pyrefly: ignore [missing-import]
from fastapi.responses import JSONResponse

# Parse allowed origins & hosts
origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
hosts = [h.strip() for h in settings.allowed_hosts.split(",") if h.strip()]

# Universal CORS & IP Filter Middleware
@app.middleware("http")
async def cors_and_ip_filter_middleware(request: Request, call_next):
    # Handle preflight OPTIONS request directly with full CORS headers
    if request.method == "OPTIONS":
        response = JSONResponse(status_code=200, content={"status": "ok"})
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response

    if "*" not in hosts:
        client_ip = request.client.host if request.client else ""
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
            
        if client_ip not in hosts and "127.0.0.1" not in hosts and "localhost" not in hosts:
            logger.warning(f"Blocked request from unauthorized IP: {client_ip}")
            return JSONResponse(status_code=403, content={"detail": f"Access denied for IP: {client_ip}"})
            
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response


class TokenRequest(BaseModel):
    room_name: str
    participant_name: str


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[Message] = []


class VoiceTranscriptTurn(BaseModel):
    username: str
    role: str
    content: str


from fastapi import Depends
from database import (
    init_db, get_user_by_username, get_all_users, create_user, delete_user, update_user_password,
    save_conversation_turn, get_user_conversation_history, clear_user_conversation_history,
    save_vault_item, get_vault_items, delete_vault_item, create_reminder, get_user_reminders,
    create_task, get_user_tasks, toggle_task_completion, delete_task,
    create_note, get_user_notes, create_calendar_event, get_user_calendar_events,
    check_scheduling_conflicts, update_calendar_event, delete_calendar_event,
    create_financial_transaction, get_user_financial_transactions, delete_financial_transaction,
    get_finance_summary, create_subscription, get_user_subscriptions, delete_subscription,
    create_shopping_item, get_user_shopping_items, toggle_shopping_item, delete_shopping_item,
    get_all_smart_home_devices, update_smart_home_device, get_all_automation_routines, execute_automation_routine
)
from security import encrypt_vault_data, decrypt_vault_data
from backup_daemon import trigger_postgresql_backup, get_backup_history, check_backup_liveness_alert
from proactive_daemon import audit_proactive_system_alerts, proactive_daemon_loop
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, get_admin_user, validate_password_complexity
)

import asyncio

@app.on_event("startup")
async def on_startup():
    await init_db()
    asyncio.create_task(proactive_daemon_loop())

class SmartDeviceUpdateRequest(BaseModel):
    is_on: Optional[bool] = None
    settings: Optional[dict] = None

@app.get("/api/proactive/alerts")
async def get_proactive_alerts(current_user: dict = Depends(get_current_user)):
    """Fetch proactive system audit alerts (task deadlines, calendar reminders, subscription bills, backup status)."""
    try:
        alerts = await audit_proactive_system_alerts()
        return alerts
    except Exception as e:
        logger.error(f"Failed to fetch proactive alerts: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch proactive alerts. Please try again.")

@app.get("/api/smart-home/devices")
async def list_smart_devices(current_user: dict = Depends(get_current_user)):
    """Fetch all registered smart home IoT devices and their current state."""
    try:
        devices = await get_all_smart_home_devices()
        return devices
    except Exception as e:
        logger.error(f"Failed to fetch smart home devices: {e}")
        raise HTTPException(status_code=500, detail="Failed to load smart home devices.")

@app.patch("/api/smart-home/devices/{device_id}")
async def update_smart_device(device_id: int, req: SmartDeviceUpdateRequest, current_user: dict = Depends(get_current_user)):
    """Toggle power state or update settings for a smart home device."""
    try:
        res = await update_smart_home_device(device_id, is_on=req.is_on, settings=req.settings)
        if not res:
            raise HTTPException(status_code=404, detail="Smart device not found")
        return res
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update smart device {device_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update device. Please try again.")

@app.get("/api/smart-home/routines")
async def list_automation_routines(current_user: dict = Depends(get_current_user)):
    """Fetch all available one-touch automation macro routines."""
    try:
        routines = await get_all_automation_routines()
        return routines
    except Exception as e:
        logger.error(f"Failed to fetch automation routines: {e}")
        raise HTTPException(status_code=500, detail="Failed to load automation routines.")

@app.post("/api/smart-home/routines/{routine_id}/execute")
async def trigger_routine(routine_id: int, current_user: dict = Depends(get_current_user)):
    """Execute a one-touch automation macro routine, updating all associated device states."""
    try:
        res = await execute_automation_routine(routine_id)
        if res.get("status") == "error":
            raise HTTPException(status_code=404, detail=res.get("message"))
        return res
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to execute routine {routine_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to execute routine. Please try again.")


class TaskRequest(BaseModel):
    title: str
    description: Optional[str] = ""
    priority: Optional[str] = "P3"
    category: Optional[str] = "General"
    due_date: Optional[str] = None

class NoteRequest(BaseModel):
    title: str
    content: str
    tags: Optional[List[str]] = []

@app.post("/api/tasks")
async def add_task(req: TaskRequest, current_user: dict = Depends(get_current_user)):
    """Create a new task for the authenticated user with priority and category."""
    try:
        desc = req.description or ""
        prio = req.priority or "P3"
        cat = req.category or "General"
        item = await create_task(current_user["id"], req.title, desc, prio, cat, req.due_date)
        return item
    except Exception as e:
        logger.error(f"Failed to create task: {e}")
        raise HTTPException(status_code=500, detail="Failed to create task. Please try again.")

@app.get("/api/tasks")
async def list_tasks(current_user: dict = Depends(get_current_user)):
    """Fetch all tasks for the authenticated user. Admins see all users' tasks."""
    try:
        is_admin = current_user.get("role") == "admin"
        tasks = await get_user_tasks(current_user["id"], is_admin=is_admin)
        return tasks
    except Exception as e:
        logger.error(f"Failed to fetch tasks: {e}")
        raise HTTPException(status_code=500, detail="Failed to load tasks. Please try again.")

@app.patch("/api/tasks/{task_id}/toggle")
async def toggle_task(task_id: int, current_user: dict = Depends(get_current_user)):
    """Toggle the completion status of a task."""
    try:
        is_admin = current_user.get("role") == "admin"
        res = await toggle_task_completion(task_id, current_user["id"], is_admin=is_admin)
        if not res:
            raise HTTPException(status_code=404, detail="Task not found")
        return res
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to toggle task {task_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update task. Please try again.")

@app.delete("/api/tasks/{task_id}")
async def remove_task(task_id: int, current_user: dict = Depends(get_current_user)):
    """Permanently delete a task by ID."""
    try:
        is_admin = current_user.get("role") == "admin"
        success = await delete_task(task_id, current_user["id"], is_admin=is_admin)
        if not success:
            raise HTTPException(status_code=404, detail="Task not found")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete task {task_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete task. Please try again.")

@app.post("/api/notes")
async def add_note(req: NoteRequest, current_user: dict = Depends(get_current_user)):
    """Create a new note with optional tags for the authenticated user."""
    try:
        tags_list = req.tags or []
        note = await create_note(current_user["id"], req.title, req.content, tags_list)
        return note
    except Exception as e:
        logger.error(f"Failed to create note: {e}")
        raise HTTPException(status_code=500, detail="Failed to create note. Please try again.")

@app.get("/api/notes")
async def list_notes(current_user: dict = Depends(get_current_user)):
    """Fetch all notes for the authenticated user."""
    try:
        notes = await get_user_notes(current_user["id"])
        return notes
    except Exception as e:
        logger.error(f"Failed to fetch notes: {e}")
        raise HTTPException(status_code=500, detail="Failed to load notes. Please try again.")

# Calendar & Meetings Pydantic Models & Endpoints (Sprint 2)
class CalendarEventRequest(BaseModel):
    title: str
    start_time: str
    end_time: str
    description: Optional[str] = ""
    location: Optional[str] = ""
    attendees: Optional[List[str]] = []
    agenda: Optional[str] = ""

class GenerateAgendaRequest(BaseModel):
    title: str
    description: Optional[str] = ""

@app.get("/api/calendar")
async def fetch_calendar_events(current_user: dict = Depends(get_current_user)):
    """Fetch user calendar events."""
    return await get_user_calendar_events(current_user["id"])

@app.post("/api/calendar")
async def add_calendar_event(req: CalendarEventRequest, current_user: dict = Depends(get_current_user)):
    """Create a calendar event with conflict check."""
    conflicts = await check_scheduling_conflicts(current_user["id"], req.start_time, req.end_time)
    event = await create_calendar_event(
        user_id=current_user["id"],
        title=req.title,
        start_time=req.start_time,
        end_time=req.end_time,
        description=req.description or "",
        location=req.location or "",
        attendees=req.attendees or [],
        agenda=req.agenda or ""
    )
    return {"event": event, "conflicts": conflicts}

@app.delete("/api/calendar/{event_id}")
async def remove_calendar_event(event_id: int, current_user: dict = Depends(get_current_user)):
    """Delete a calendar event."""
    success = await delete_calendar_event(event_id, current_user["id"])
    if not success:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"status": "success"}

@app.post("/api/calendar/generate-agenda")
async def generate_agenda(req: GenerateAgendaRequest, current_user: dict = Depends(get_current_user)):
    """Use Ollama LLM to generate a structured meeting agenda."""
    prompt = f"Generate a concise, professional 4-bullet meeting agenda for a meeting titled '{req.title}'."
    if req.description:
        prompt += f" Context: {req.description}"
    
    agenda_text = ""
    try:
        payload = {
            "model": settings.ollama_model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False
        }
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{settings.validated_ollama_base_url}/api/chat",
                json=payload,
                timeout=15.0
            )
            if res.status_code == 200:
                data = res.json()
                agenda_text = data.get("message", {}).get("content", "")
    except Exception as e:
        logger.warning(f"Agenda generation fallback: {e}")
    
    if not agenda_text:
        agenda_text = f"1. Introduction & Context\n2. Key Objectives for {req.title}\n3. Action Items & Assignments\n4. Next Steps"
    
    return {"agenda": agenda_text}


class ImportIcsRequest(BaseModel):
    ics_content: Optional[str] = None
    ics_data: Optional[str] = None


def _format_ics_datetime(dt_str: str) -> str:
    """Format an ISO string into standard iCalendar UTC format YYYYMMDDTHHMMSSZ."""
    try:
        clean_str = dt_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean_str)
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc)
        return dt.strftime("%Y%m%dT%H%M%SZ")
    except Exception:
        now_dt = datetime.now(timezone.utc)
        return now_dt.strftime("%Y%m%dT%H%M%SZ")


@app.get("/api/calendar/feed.ics")
async def get_calendar_ics_feed(username: str = "admin", token: Optional[str] = None):
    """
    Standard RFC 5545 iCalendar feed.
    Can be subscribed to from Google Calendar ('From URL'), Apple Calendar, or Microsoft Outlook.
    """
    user = await get_user_by_username(username)
    if not user:
        user = await get_user_by_username("admin")
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    events = await get_user_calendar_events(user["id"])
    now_stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Rocky AI//Virtual Assistant 4.0//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:Rocky Schedule ({user['username']})",
        "X-WR-TIMEZONE:UTC",
    ]

    for ev in events:
        start_ics = _format_ics_datetime(ev.get("start_time", ""))
        end_ics = _format_ics_datetime(ev.get("end_time", ""))
        title = ev.get("title", "Scheduled Event").replace("\n", " ").replace(",", "\\,")
        desc = (ev.get("description", "") or ev.get("agenda", "") or "").replace("\n", "\\n").replace(",", "\\,")
        loc = (ev.get("location", "") or "").replace("\n", " ").replace(",", "\\,")
        ev_id = ev.get("id", "0")

        lines.extend([
            "BEGIN:VEVENT",
            f"UID:rocky-event-{ev_id}-{user['id']}@rocky.ai",
            f"DTSTAMP:{now_stamp}",
            f"DTSTART:{start_ics}",
            f"DTEND:{end_ics}",
            f"SUMMARY:{title}",
            f"DESCRIPTION:{desc}",
            f"LOCATION:{loc}",
            "STATUS:CONFIRMED",
            "END:VEVENT",
        ])

    lines.append("END:VCALENDAR\r\n")
    ics_body = "\r\n".join(lines)

    return Response(
        content=ics_body,
        media_type="text/calendar",
        headers={
            "Content-Disposition": f'inline; filename="rocky-schedule-{user["username"]}.ics"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
        }
    )


@app.post("/api/calendar/import-ics")
async def import_ics_events(req: ImportIcsRequest, current_user: dict = Depends(get_current_user)):
    """
    Import standard .ics events from Google Calendar, Apple Calendar, or Outlook.
    """
    raw = req.ics_content or req.ics_data or ""
    event_blocks = re.findall(r"BEGIN:VEVENT(.*?)END:VEVENT", raw, re.DOTALL | re.IGNORECASE)
    imported = []

    for block in event_blocks:
        summary_m = re.search(r"SUMMARY:(.*?)(?:\r?\n[A-Z]|\r?\nEND:)", block, re.DOTALL)
        dtstart_m = re.search(r"DTSTART(?:;[^:]+)?:([^\r\n]+)", block)
        dtend_m = re.search(r"DTEND(?:;[^:]+)?:([^\r\n]+)", block)
        desc_m = re.search(r"DESCRIPTION:(.*?)(?:\r?\n[A-Z]|\r?\nEND:)", block, re.DOTALL)
        loc_m = re.search(r"LOCATION:(.*?)(?:\r?\n[A-Z]|\r?\nEND:)", block, re.DOTALL)

        title = summary_m.group(1).strip().replace("\\,", ",").replace("\\n", " ") if summary_m else "Imported Event"
        start_raw = dtstart_m.group(1).strip() if dtstart_m else ""
        end_raw = dtend_m.group(1).strip() if dtend_m else ""
        description = desc_m.group(1).strip().replace("\\,", ",").replace("\\n", "\n") if desc_m else ""
        location = loc_m.group(1).strip().replace("\\,", ",").replace("\\n", " ") if loc_m else ""

        def parse_ics_date(val: str) -> str:
            val = val.strip()
            try:
                if len(val) >= 15 and "T" in val:
                    dt = datetime.strptime(val[:15], "%Y%m%dT%H%M%S")
                    return dt.replace(tzinfo=timezone.utc).isoformat()
                elif len(val) == 8:
                    dt = datetime.strptime(val, "%Y%m%d")
                    return dt.replace(tzinfo=timezone.utc).isoformat()
            except Exception:
                pass
            return datetime.now(timezone.utc).isoformat()

        start_iso = parse_ics_date(start_raw) if start_raw else datetime.now(timezone.utc).isoformat()
        end_iso = parse_ics_date(end_raw) if end_raw else (datetime.fromisoformat(start_iso) + timedelta(hours=1)).isoformat()

        ev = await create_calendar_event(
            user_id=current_user["id"],
            title=title,
            start_time=start_iso,
            end_time=end_iso,
            description=description,
            location=location,
            attendees=[],
            agenda=""
        )
        imported.append(ev)

    return {"status": "success", "imported_count": len(imported), "events": imported}


# Finance & Money Management Pydantic Models & Endpoints (Sprint 3)
class TransactionRequest(BaseModel):
    type: str = "expense"
    category: str = "General"
    amount: float
    merchant: Optional[str] = ""
    transaction_date: Optional[str] = None
    notes: Optional[str] = ""

class SubscriptionRequest(BaseModel):
    service_name: str
    amount: float
    next_billing_date: str
    billing_cycle: Optional[str] = "monthly"
    category: Optional[str] = "Subscription"

class ShoppingItemRequest(BaseModel):
    item_name: str
    quantity: Optional[int] = 1
    category: Optional[str] = "General"
    warranty_expiry: Optional[str] = None

@app.get("/api/finance/transactions")
async def fetch_transactions(current_user: dict = Depends(get_current_user)):
    """Fetch all financial transactions for current user."""
    return await get_user_financial_transactions(current_user["id"])

@app.post("/api/finance/transactions")
async def add_transaction(req: TransactionRequest, current_user: dict = Depends(get_current_user)):
    """Create a new expense or income transaction."""
    return await create_financial_transaction(
        user_id=current_user["id"],
        type=req.type,
        category=req.category,
        amount=req.amount,
        merchant=req.merchant or "",
        transaction_date=req.transaction_date,
        notes=req.notes or ""
    )

@app.delete("/api/finance/transactions/{tx_id}")
async def remove_transaction(tx_id: int, current_user: dict = Depends(get_current_user)):
    """Delete a financial transaction."""
    success = await delete_financial_transaction(tx_id, current_user["id"])
    if not success:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"status": "success"}

@app.get("/api/finance/summary")
async def fetch_finance_summary(current_user: dict = Depends(get_current_user)):
    """Fetch spending breakdown and net savings summary."""
    return await get_finance_summary(current_user["id"])

@app.get("/api/finance/subscriptions")
async def fetch_subscriptions(current_user: dict = Depends(get_current_user)):
    """Fetch tracked subscriptions and bill reminders."""
    return await get_user_subscriptions(current_user["id"])

@app.post("/api/finance/subscriptions")
async def add_subscription(req: SubscriptionRequest, current_user: dict = Depends(get_current_user)):
    """Add a recurring subscription / bill reminder."""
    return await create_subscription(
        user_id=current_user["id"],
        service_name=req.service_name,
        amount=req.amount,
        next_billing_date=req.next_billing_date,
        billing_cycle=req.billing_cycle or "monthly",
        category=req.category or "Subscription"
    )

@app.delete("/api/finance/subscriptions/{sub_id}")
async def remove_subscription(sub_id: int, current_user: dict = Depends(get_current_user)):
    """Delete a subscription tracker."""
    success = await delete_subscription(sub_id, current_user["id"])
    if not success:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return {"status": "success"}

@app.get("/api/shopping")
async def fetch_shopping_items(current_user: dict = Depends(get_current_user)):
    """Fetch shopping list items."""
    return await get_user_shopping_items(current_user["id"])

@app.post("/api/shopping")
async def add_shopping_item(req: ShoppingItemRequest, current_user: dict = Depends(get_current_user)):
    """Add an item to the shopping list."""
    return await create_shopping_item(
        user_id=current_user["id"],
        item_name=req.item_name,
        quantity=req.quantity or 1,
        category=req.category or "General",
        warranty_expiry=req.warranty_expiry
    )

@app.patch("/api/shopping/{item_id}/toggle")
async def patch_shopping_item_toggle(item_id: int, current_user: dict = Depends(get_current_user)):
    """Toggle purchased status of a shopping item."""
    res = await toggle_shopping_item(item_id, current_user["id"])
    if not res:
        raise HTTPException(status_code=404, detail="Shopping item not found")
    return res

@app.delete("/api/shopping/{item_id}")
async def remove_shopping_item(item_id: int, current_user: dict = Depends(get_current_user)):
    """Delete a shopping list item."""
    success = await delete_shopping_item(item_id, current_user["id"])
    if not success:
        raise HTTPException(status_code=404, detail="Shopping item not found")
    return {"status": "success"}

# Critical Vault & Backup Engine Endpoints (Sprint 4)
class VaultItemRequest(BaseModel):
    category: str
    secret_value: str
    notes: Optional[str] = ""

@app.get("/api/vault")
async def fetch_vault_items(current_user: dict = Depends(get_current_user)):
    """Fetch and decrypt all vault items for authenticated owner or admin."""
    try:
        is_admin = current_user.get("role") == "admin"
        raw_items = await get_vault_items(current_user["id"], is_admin=is_admin)
        decrypted_items = []
        for item in raw_items:
            d = dict(item)
            d["decrypted_value"] = decrypt_vault_data(d["encrypted_value"])
            decrypted_items.append(d)
        return decrypted_items
    except Exception as e:
        logger.error(f"Failed to fetch vault items: {e}")
        raise HTTPException(status_code=500, detail="Failed to load vault items. Please try again.")

@app.post("/api/vault")
async def add_vault_item(req: VaultItemRequest, current_user: dict = Depends(get_current_user)):
    """Encrypt and store a secret item into the Critical Vault using AES-256 Fernet."""
    try:
        cipher = encrypt_vault_data(req.secret_value)
        res = await save_vault_item(
            user_id=current_user["id"],
            category=req.category,
            encrypted_value=cipher,
            notes=req.notes or ""
        )
        res["decrypted_value"] = req.secret_value
        return res
    except Exception as e:
        logger.error(f"Failed to store vault item: {e}")
        raise HTTPException(status_code=500, detail="Failed to store vault item. Encryption or database error.")

@app.delete("/api/vault/{item_id}")
async def remove_vault_item(item_id: int, current_user: dict = Depends(get_current_user)):
    """Permanently purge a vault item from the encrypted store."""
    try:
        is_admin = current_user.get("role") == "admin"
        success = await delete_vault_item(item_id, current_user["id"], is_admin=is_admin)
        if not success:
            raise HTTPException(status_code=404, detail="Vault item not found")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete vault item {item_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete vault item. Please try again.")

@app.get("/api/admin/backups")
async def fetch_backups(admin: dict = Depends(get_admin_user)):
    """List database backup snapshot history and liveness status."""
    history = get_backup_history()
    liveness = check_backup_liveness_alert()
    return {"history": history, "liveness": liveness}

@app.post("/api/admin/backup")
async def trigger_manual_backup(admin: dict = Depends(get_admin_user)):
    """Trigger instant PostgreSQL database backup snapshot."""
    res = trigger_postgresql_backup()
    if res.get("status") != "success":
        raise HTTPException(status_code=500, detail=res.get("message", "Backup failed"))
    return res

class LoginRequest(BaseModel):
    username: str
    password: str

class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str = "user"

@app.post("/api/auth/login")
async def login(request: LoginRequest):
    user = await get_user_by_username(request.username)
    if not user or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    token = create_access_token({"sub": user["username"], "user_id": user["id"], "role": user["role"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"]
        }
    }

@app.get("/api/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

@app.get("/api/admin/users")
async def list_users(admin: dict = Depends(get_admin_user)):
    return await get_all_users()


@app.post("/api/admin/users")
async def add_user(request: CreateUserRequest, admin: dict = Depends(get_admin_user)):
    existing = await get_user_by_username(request.username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    if not validate_password_complexity(request.password):
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long and contain a combination of uppercase (A-Z), lowercase (a-z), number (0-9), and special symbol."
        )
    
    hashed = hash_password(request.password)
    user = await create_user(request.username, hashed, request.role)
    return user

class ResetPasswordRequest(BaseModel):
    new_password: str

@app.post("/api/admin/users/{user_id}/reset-password")
async def admin_reset_password(user_id: int, req: ResetPasswordRequest, admin: dict = Depends(get_admin_user)):
    """Allow admin role to reset/change password for any user."""
    if not validate_password_complexity(req.new_password):
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long and contain a combination of uppercase (A-Z), lowercase (a-z), number (0-9), and special symbol."
        )
    
    hashed = hash_password(req.new_password)
    success = await update_user_password(user_id, hashed)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "success", "message": "Password updated successfully"}

@app.delete("/api/admin/users/{user_id}")
async def remove_user(user_id: int, admin: dict = Depends(get_admin_user)):
    success = await delete_user(user_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot delete main admin user or user not found")
    return {"status": "success"}

@app.get("/api/history")
async def get_history(limit: int = 10, offset: int = 0, today_only: bool = False, current_user: dict = Depends(get_current_user)):
    """Fetch paginated isolated conversation history for current authenticated user."""
    res = await get_user_conversation_history(current_user["id"], limit=limit, offset=offset, today_only=today_only)
    return res

@app.delete("/api/history")
async def clear_history(current_user: dict = Depends(get_current_user)):
    """Clear isolated conversation history for current authenticated user."""
    await clear_user_conversation_history(current_user["id"])
    return {"status": "success"}


@app.post("/api/token")
async def generate_token(request: TokenRequest, current_user: dict = Depends(get_current_user)):
    """
    Generate a LiveKit JWT token for an authenticated user to join a voice room.
    """
    if not settings.livekit_api_key or not settings.livekit_api_secret:
        raise HTTPException(status_code=500, detail="LiveKit credentials not configured.")

    token = api.AccessToken(
        settings.livekit_api_key, settings.livekit_api_secret
    )
    
    token.with_identity(current_user["username"]).with_name(current_user["username"])
    token.with_grants(
        api.VideoGrants(
            room_join=True,
            room=request.room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True,
        )
    )

    jwt_token = token.to_jwt()
    return {"token": jwt_token}


@app.post("/api/voice/transcript")
async def record_voice_transcript(turn: VoiceTranscriptTurn):
    """
    Persist voice conversation turn (user speech or Rocky response) to user history.
    """
    if not turn.content or not turn.content.strip():
        return {"status": "ignored_empty"}
    user = await get_user_by_username(turn.username)
    if not user:
        user = await get_user_by_username("admin")
    if user:
        await save_conversation_turn(user["id"], turn.role, turn.content.strip())
        return {"status": "success", "user_id": user["id"]}
    return {"status": "user_not_found"}


@app.get("/api/voice/history")
async def fetch_voice_user_history(username: str = "admin", limit: int = 10):
    """
    Fetch recent conversation history for the agent to load on session start.
    """
    user = await get_user_by_username(username)
    if not user:
        user = await get_user_by_username("admin")
    if user:
        history_data = await get_user_conversation_history(user["id"], limit=limit, today_only=True)
        messages = history_data.get("messages", []) if isinstance(history_data, dict) else history_data
        return {"messages": messages}
    return {"messages": []}


# ---------------------------------------------------------------------------
# Fast STT Endpoint (Ambient Dictation & Decoupled Speech-to-Text)
# ---------------------------------------------------------------------------
@app.post("/api/voice/stt")
async def voice_speech_to_text(request: Request):
    """
    Decoupled ultra-fast STT endpoint for Ambient Dictation and voice services.
    Proxies audio directly to the fast agent STT micro-service.
    """
    try:
        audio_bytes = await request.body()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Empty audio payload")

        content_type = request.headers.get("content-type", "audio/wav")
        agent_url = os.getenv("INTERNAL_AGENT_URL", "http://agent:8334")
        async with httpx.AsyncClient(timeout=15.0) as client:
            headers = {"Content-Type": content_type}
            resp = await client.post(f"{agent_url}/stt", content=audio_bytes, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "status": "success",
                    "transcript": data.get("transcript", ""),
                    "language": data.get("language", "en"),
                    "latency_ms": data.get("latency_ms", 0)
                }
            else:
                logger.warning(f"Agent STT returned {resp.status_code}: {resp.text}")
                return {"status": "error", "error": f"Agent STT returned {resp.status_code}", "transcript": ""}
    except Exception as e:
        logger.error(f"Error during voice STT proxy: {e}", exc_info=True)
        return {"status": "error", "error": str(e), "transcript": ""}



# ---------------------------------------------------------------------------
# HitL (Human-in-the-Loop) Safeguard Endpoints
# ---------------------------------------------------------------------------
class HitLStageRequest(BaseModel):
    username: str = "admin"
    category: str
    title: str
    command: str
    target: str
    details: Dict[str, Any] = {}
    ttl_seconds: int = 60

class HitLDecisionRequest(BaseModel):
    action_id: str
    username: str = "admin"

@app.post("/api/assistant/hitl/stage")
async def stage_hitl_safeguard_action(req: HitLStageRequest):
    """
    Stage a destructive action (file deletion, terminal write, email sending)
    for explicit Human-in-the-Loop confirmation.
    """
    try:
        cat = HitLCategory(req.category)
    except Exception:
        cat = HitLCategory.SYSTEM_MODIFICATION

    action = hitl_stage_action(
        username=req.username,
        category=cat,
        title=req.title,
        command=req.command,
        target=req.target,
        details=req.details,
        ttl_seconds=req.ttl_seconds
    )
    return {"status": "staged", "action": action}

@app.get("/api/assistant/hitl/pending")
async def list_pending_hitl_actions(username: Optional[str] = None):
    """List all active unexpired pending HitL approvals."""
    pending = hitl_get_pending_actions(username=username)
    return {"pending": pending, "count": len(pending)}

@app.get("/api/assistant/hitl/{action_id}")
async def fetch_hitl_action(action_id: str):
    """Inspect status of a specific HitL action."""
    action = hitl_get_action(action_id)
    if not action:
        raise HTTPException(status_code=404, detail="HitL action not found")
    return {"action": action}

@app.post("/api/assistant/hitl/confirm")
async def confirm_hitl_safeguard_action(req: HitLDecisionRequest):
    """Explicitly authorize and execute a staged destructive action."""
    result = await hitl_confirm_action(req.action_id, req.username)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result

@app.post("/api/assistant/hitl/reject")
async def reject_hitl_safeguard_action(req: HitLDecisionRequest):
    """Explicitly abort a staged destructive action."""
    result = await hitl_reject_action(req.action_id, req.username)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result


class AssistantActionRequest(BaseModel):
    username: str = "admin"
    action: str
    data: Dict[str, Any] = {}


@app.post("/api/assistant/action")

async def execute_assistant_action(req: AssistantActionRequest):
    """
    Unified assistant action execution endpoint for voice & chat tools.
    Supports:
      - add_shopping_item: { "name": ..., "quantity": "1", "category": "Grocery" }
      - create_calendar_event: { "title": ..., "start_time": ..., "end_time": ..., "location": ..., "description": ... }
      - create_reminder: { "title": ..., "scheduled_at": ..., "description": ... }
      - create_task: { "title": ..., "priority": "P2", "due_date": ... }
      - get_calendar_events: {}
      - get_shopping_items: {}
      - get_tasks: {}
    """
    user = await get_user_by_username(req.username)
    if not user:
        user = await get_user_by_username("admin")
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_id = user["id"]
    action = req.action
    payload = req.data or {}

    if action == "add_shopping_item":
        name = payload.get("name", "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="Item name required")
        qty_raw = payload.get("quantity", 1)
        try:
            if isinstance(qty_raw, str):
                m = re.search(r"\d+", qty_raw)
                qty = int(m.group(0)) if m else 1
            else:
                qty = int(qty_raw)
        except Exception:
            qty = 1
        cat = str(payload.get("category", "Grocery"))
        item = await create_shopping_item(user_id, name, qty, cat, payload.get("warranty_expiry"))
        return {"status": "success", "action": action, "item": item}

    elif action == "create_calendar_event":
        title = payload.get("title", "").strip()
        if not title:
            raise HTTPException(status_code=400, detail="Event title required")
        start_time = payload.get("start_time") or datetime.now(timezone.utc).isoformat()
        end_time = payload.get("end_time")
        if not end_time:
            try:
                st = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
                end_time = (st + timedelta(hours=1)).isoformat()
            except Exception:
                end_time = start_time
        
        event = await create_calendar_event(
            user_id=user_id,
            title=title,
            start_time=start_time,
            end_time=end_time,
            description=payload.get("description", ""),
            location=payload.get("location", ""),
            attendees=payload.get("attendees", []),
            agenda=payload.get("agenda", "")
        )
        return {"status": "success", "action": action, "event": event}

    elif action == "create_reminder":
        title = payload.get("title", "").strip()
        if not title:
            raise HTTPException(status_code=400, detail="Reminder title required")
        scheduled_at = payload.get("scheduled_at") or datetime.now(timezone.utc).isoformat()
        desc = payload.get("description", "Reminder created by Rocky")

        # 1. Reminders Table
        rem = await create_reminder(
            user_id=user_id,
            title=title,
            scheduled_at=scheduled_at,
            description=desc
        )

        # 2. Calendar Schedule Table (so it appears in Calendar & syncs to Google Cal)
        clean_cal_title = f"Reminder: {title}" if not title.lower().startswith("reminder") else title
        try:
            st = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
            et = (st + timedelta(minutes=30)).isoformat()
        except Exception:
            et = scheduled_at

        try:
            await create_calendar_event(
                user_id=user_id,
                title=clean_cal_title,
                start_time=scheduled_at,
                end_time=et,
                description=desc,
                location="",
                attendees=[],
                agenda=""
            )
        except Exception as e:
            logger.warning(f"Could not auto-sync reminder to calendar_events: {e}")

        # 3. Task Matrix Table (so it appears in Tasks)
        try:
            await create_task(
                user_id=user_id,
                title=clean_cal_title,
                description=desc,
                priority="P2",
                category="Reminder",
                due_date=scheduled_at
            )
        except Exception as e:
            logger.warning(f"Could not auto-sync reminder to user_tasks: {e}")

        return {"status": "success", "action": action, "reminder": rem}

    elif action == "create_task":
        title = payload.get("title", "").strip()
        if not title:
            raise HTTPException(status_code=400, detail="Task title required")
        task = await create_task(
            user_id=user_id,
            title=title,
            description=payload.get("description", ""),
            priority=payload.get("priority", "P3"),
            category=payload.get("category", "General"),
            due_date=payload.get("due_date")
        )
        return {"status": "success", "action": action, "task": task}

    elif action == "get_calendar_events":
        events = await get_user_calendar_events(user_id)
        return {"status": "success", "action": action, "events": events}

    elif action == "get_shopping_items":
        items = await get_user_shopping_items(user_id)
        return {"status": "success", "action": action, "items": items}

    elif action == "get_tasks":
        tasks = await get_user_tasks(user_id)
        return {"status": "success", "action": action, "tasks": tasks}

    # Destructive Action Gatekeepers (Protected by HitL)
    elif action in ("execute_terminal", "delete_file", "send_email", "clear_history"):
        # Check if an authorized action_id is supplied
        action_id = payload.get("action_id")
        if not action_id:
            # Stage action for approval
            destructive_info = detect_destructive_intent(payload.get("command", action))
            cat = destructive_info["category"] if destructive_info else HitLCategory.SYSTEM_MODIFICATION
            title = destructive_info["title"] if destructive_info else f"Action: {action}"
            target = destructive_info["target"] if destructive_info else "System"
            staged = hitl_stage_action(
                username=req.username,
                category=cat,
                title=title,
                command=payload.get("command", action),
                target=target,
                details=payload
            )
            return {
                "status": "confirmation_required",
                "message": f"HitL authorization required for destructive action {action}",
                "hitl": staged
            }
        else:
            # Execute confirmed action
            res = await hitl_confirm_action(action_id, req.username)
            return res

    else:
        raise HTTPException(status_code=400, detail=f"Unknown assistant action: {action}")




def parse_reminder_request(text: str):
    """
    Parses natural language reminder requests like:
      - 'add a reminder to call my friends tomorrow at 10 AM'
      - 'remind me to inspect servers tomorrow at 2:30 PM'
      - 'set a reminder to take medicine tonight'
      - 'create a reminder for team review in 2 hours'
    Extracts clean title, exact scheduled_at ISO string, and friendly display_time.
    """
    clean = text.strip()
    pattern = r"^(?:please\s+)?(?:add\s+(?:a\s+)?reminder\s+(?:to|for)?|set\s+(?:a\s+)?reminder\s+(?:to|for)?|create\s+(?:a\s+)?reminder\s+(?:to|for)?|remind\s+me\s+(?:to|about)?)\s+(.+)$"
    m = re.search(pattern, clean, re.IGNORECASE)
    if not m:
        m = re.search(r"^(?:a\s+)?reminder\s+(?:to|for)\s+(.+)$", clean, re.IGNORECASE)
        if not m:
            return None

    raw_body = m.group(1).strip()
    now = datetime.now()
    target_date = now.date()
    target_hour = 9
    target_minute = 0

    if re.search(r"\bday\s+after\s+tomorrow\b", raw_body, re.IGNORECASE):
        target_date = now.date() + timedelta(days=2)
        raw_body = re.sub(r"\bday\s+after\s+tomorrow\b", "", raw_body, flags=re.IGNORECASE)
    elif re.search(r"\btomorrow\b", raw_body, re.IGNORECASE):
        target_date = now.date() + timedelta(days=1)
        raw_body = re.sub(r"\btomorrow\b", "", raw_body, flags=re.IGNORECASE)
    elif re.search(r"\btoday\b", raw_body, re.IGNORECASE):
        target_date = now.date()
        raw_body = re.sub(r"\btoday\b", "", raw_body, flags=re.IGNORECASE)
    elif re.search(r"\btonight\b", raw_body, re.IGNORECASE):
        target_date = now.date()
        target_hour = 20
        raw_body = re.sub(r"\btonight\b", "", raw_body, flags=re.IGNORECASE)

    rel_m = re.search(r"\bin\s+(\d+)\s*(hour|hr|minute|min)s?\b", raw_body, re.IGNORECASE)
    if rel_m:
        val = int(rel_m.group(1))
        unit = rel_m.group(2).lower()
        target_dt = now + timedelta(hours=val) if ("hour" in unit or "hr" in unit) else now + timedelta(minutes=val)
        raw_body = re.sub(r"\bin\s+(\d+)\s*(?:hour|hr|minute|min)s?\b", "", raw_body, flags=re.IGNORECASE)
        target_date = target_dt.date()
        target_hour = target_dt.hour
        target_minute = target_dt.minute
    else:
        time_m = re.search(r"(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b", raw_body, re.IGNORECASE)
        if time_m:
            hr_val = int(time_m.group(1))
            min_val = int(time_m.group(2)) if time_m.group(2) else 0
            meridiem = time_m.group(3).lower() if time_m.group(3) else None
            matched_text = time_m.group(0).strip()
            if meridiem or "at" in matched_text.lower() or hr_val > 12:
                if meridiem == "pm" and hr_val < 12:
                    hr_val += 12
                elif meridiem == "am" and hr_val == 12:
                    hr_val = 0
                target_hour = hr_val
                target_minute = min_val
                raw_body = re.sub(re.escape(matched_text), "", raw_body)

    clean_title = re.sub(r"\s+", " ", raw_body).strip()
    clean_title = re.sub(r"^(?:at|on|for)\s+", "", clean_title, flags=re.IGNORECASE)
    clean_title = re.sub(r"\s+(?:at|on|for)$", "", clean_title, flags=re.IGNORECASE).strip()
    if not clean_title:
        clean_title = "Reminder"

    final_dt = datetime(target_date.year, target_date.month, target_date.day, target_hour, target_minute, 0)
    formatted_title = clean_title[0].upper() + clean_title[1:] if len(clean_title) > 1 else clean_title.upper()
    return {
        "title": formatted_title,
        "scheduled_at": final_dt.isoformat(),
        "display_time": final_dt.strftime("%b %d at %I:%M %p")
    }


def check_direct_assistant_action(clean_text: str):
    """
    Checks if text is a direct assistant action for shopping, calendar/reminders, tasks.
    Returns (action_type, panel, data, reply_text) or None.
    """
    clean = clean_text.strip().lower()

    # 0. HitL Destructive Action Interceptor
    hitl_match = detect_destructive_intent(clean_text)
    if hitl_match:
        staged = hitl_stage_action(
            username="admin",
            category=hitl_match["category"],
            title=hitl_match["title"],
            command=hitl_match["command"],
            target=hitl_match["target"],
            details=hitl_match.get("details", {})
        )
        return "hitl_required", "hitl", staged, hitl_match["verbal_prompt"]

    # 1. Shopping List: Add Items
    shop_add = re.search(r"(?:add|put)\s+(.+?)\s+(?:to|on|in)\s+(?:my\s+|the\s+)?shopping\s*list", clean, re.IGNORECASE)
    if not shop_add and ("buy" in clean or "purchase" in clean):
        shop_add = re.search(r"(?:need\s+to\s+buy|buy)\s+(.+)", clean, re.IGNORECASE)
        if shop_add and len(clean.split()) > 8:
            shop_add = None

    if shop_add:
        items_raw = shop_add.group(1).strip()
        items = [re.sub(r"^(?:and|a|an|some)\s+", "", it.strip(), flags=re.IGNORECASE) 
                 for it in re.split(r",|\band\b|&", items_raw) if it.strip()]
        if items:
            return "add_shopping_item", "shopping", items, f"I have added {', '.join(it.capitalize() for it in items)} to your shopping list, sir. Opening the shopping panel."

    # 2. Shopping List: View
    if re.search(r"(?:open|show|display|view)\s+(?:my\s+|the\s+)?shopping\s*list", clean, re.IGNORECASE):
        return "view_shopping", "shopping", {}, "Opening your shopping list now, sir."

    # 3. Reminders: Set / Add Reminder (supports "add a reminder to...", "remind me to...", etc.)
    rem_info = parse_reminder_request(clean_text)
    if rem_info:
        title = rem_info["title"]
        scheduled_at = rem_info["scheduled_at"]
        disp_time = rem_info["display_time"]
        return "create_reminder", "calendar", {
            "title": title,
            "scheduled_at": scheduled_at,
            "display_time": disp_time
        }, f"I have set a reminder to '{title}' for {disp_time}, sir. It has been synchronized across your Calendar, Reminders, and Task Matrix."

    # 4. Calendar & Meetings: Schedule Event
    cal_match = re.search(r"(?:schedule|book)\s+(?:a\s+)?(?:meeting|event|call)\s+(?:called\s+|titled\s+|for\s+)?(.+)", clean, re.IGNORECASE)
    if not cal_match:
        cal_match = re.search(r"add\s+(.+?)\s+to\s+(?:my\s+|the\s+)?calendar", clean, re.IGNORECASE)
    if cal_match:
        event_raw = cal_match.group(1).strip()
        title = event_raw.capitalize()
        start_time = (datetime.now() + timedelta(days=1)).replace(hour=10, minute=0, second=0).isoformat()
        if "tomorrow" in clean:
            start_time = (datetime.now() + timedelta(days=1)).replace(hour=14, minute=0, second=0).isoformat()
        elif "today" in clean:
            start_time = (datetime.now() + timedelta(hours=2)).replace(minute=0, second=0).isoformat()
        return "create_calendar_event", "calendar", {"title": title, "start_time": start_time}, f"I have scheduled '{title}' in your calendar, sir. Opening the calendar panel."

    # 5. Tasks: Create Task
    task_match = re.search(r"(?:create|add)\s+(?:a\s+)?task\s+(?:to\s+|for\s+)?(.+)", clean, re.IGNORECASE)
    if task_match:
        task_raw = task_match.group(1).strip()
        title = task_raw.capitalize()
        return "create_task", "tasks", {"title": title, "priority": "P2"}, f"Task '{title}' has been added to your matrix, sir. Opening the tasks panel."

    return None


@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    """
    Stream a chat response from Ollama, using user-isolated conversation memory stored in SQLite.
    Also executes direct assistant actions (shopping items, calendar, reminders, tasks).
    """
    # Fetch isolated past conversation turns for this user
    history_data = await get_user_conversation_history(current_user["id"], limit=15)
    past_history = history_data.get("messages", []) if isinstance(history_data, dict) else history_data
    
    # Save the new user prompt
    await save_conversation_turn(current_user["id"], "user", request.message)

    # Check if this is an assistant action (e.g. shopping item, calendar event, reminder, task)
    action_info = check_direct_assistant_action(request.message)
    if action_info:
        act_type, panel, act_data, reply_text = action_info
        try:
            if act_type == "add_shopping_item":
                for it in act_data:
                    await create_shopping_item(current_user["id"], it.capitalize(), 1, "Grocery", None)
            elif act_type == "create_calendar_event":
                st = act_data["start_time"]
                et = (datetime.fromisoformat(st) + timedelta(hours=1)).isoformat()
                await create_calendar_event(
                    user_id=current_user["id"],
                    title=act_data["title"],
                    start_time=st,
                    end_time=et,
                    description="Created via chat",
                    location="",
                    attendees=[],
                    agenda=""
                )
            elif act_type == "create_reminder":
                clean_title = act_data["title"]
                scheduled_at = act_data["scheduled_at"]
                disp_time = act_data.get("display_time", scheduled_at)

                # 1. Reminders table
                await create_reminder(
                    user_id=current_user["id"],
                    title=clean_title,
                    scheduled_at=scheduled_at,
                    description=f"Reminder scheduled for {disp_time}"
                )

                # 2. Calendar Events table (so it appears on Calendar & syncs to Google Cal)
                try:
                    st_dt = datetime.fromisoformat(scheduled_at)
                    et_iso = (st_dt + timedelta(minutes=30)).isoformat()
                except Exception:
                    et_iso = scheduled_at

                await create_calendar_event(
                    user_id=current_user["id"],
                    title=f"Reminder: {clean_title}",
                    start_time=scheduled_at,
                    end_time=et_iso,
                    description=f"Reminder scheduled for {disp_time}",
                    location="",
                    attendees=[],
                    agenda=""
                )

                # 3. User Tasks table (so it appears on Task Matrix)
                await create_task(
                    user_id=current_user["id"],
                    title=f"Reminder: {clean_title}",
                    priority="P2",
                    category="Reminder",
                    due_date=scheduled_at,
                    description=f"Scheduled for {disp_time}"
                )

            elif act_type == "create_task":
                await create_task(
                    user_id=current_user["id"],
                    title=act_data["title"],
                    priority=act_data["priority"],
                    due_date=None,
                    description="Created via chat"
                )
        except Exception as e:
            logger.warning(f"Failed to persist chat action {act_type}: {e}")

        # Save assistant reply to user memory
        await save_conversation_turn(current_user["id"], "assistant", reply_text)

        async def action_stream():
            yield f"data: {json.dumps({'content': reply_text, 'ui_action': {'panel': panel, 'action': act_type}})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(action_stream(), media_type="text/event-stream")

    messages = [{"role": msg["role"], "content": msg["content"]} for msg in past_history]
    messages.append({"role": "user", "content": request.message})

    payload = {
        "model": settings.ollama_model,
        "messages": messages,
        "stream": True,
    }

    async def generate():
        full_response = []
        async with httpx.AsyncClient() as client:
            try:
                async with client.stream(
                    "POST",
                    f"{settings.validated_ollama_base_url}/api/chat",
                    json=payload,
                    timeout=httpx.Timeout(60.0),
                ) as response:
                    if response.status_code != 200:
                        yield f"data: {json.dumps({'error': f'Ollama error: {response.status_code}'})}\n\n"
                        return

                    async for line in response.aiter_lines():
                        if line:
                            try:
                                data = json.loads(line)
                                if "message" in data and "content" in data["message"]:
                                    content = data["message"]["content"]
                                    full_response.append(content)
                                    yield f"event: token\ndata: {json.dumps({'content': content})}\n\n"
                                if data.get("done", False):
                                    # Save completed assistant response to user's isolated memory
                                    if full_response:
                                        await save_conversation_turn(current_user["id"], "assistant", "".join(full_response))
                                    yield "event: done\ndata: {}\n\n"
                            except json.JSONDecodeError:
                                logger.error(f"Failed to decode Ollama response line: {line}")
            except httpx.RequestError as e:
                logger.error(f"Error communicating with Ollama: {e}")
                yield f"data: {json.dumps({'error': 'Failed to communicate with LLM'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """
    WebSocket endpoint for streaming chat responses.
    """
    await websocket.accept()
    logger.info("WebSocket connection established.")

    try:
        while True:
            data = await websocket.receive_text()
            try:
                request = json.loads(data)
                if request.get("type") != "message":
                    continue

                content = request.get("content", "")
                
                payload = {
                    "model": settings.ollama_model,
                    "messages": [{"role": "user", "content": content}],
                    "stream": True,
                }

                async with httpx.AsyncClient() as client:
                    async with client.stream(
                        "POST",
                        f"{settings.validated_ollama_base_url}/api/chat",
                        json=payload,
                        timeout=httpx.Timeout(60.0),
                    ) as response:
                        if response.status_code == 200:
                            async for line in response.aiter_lines():
                                if line:
                                    try:
                                        chunk = json.loads(line)
                                        if "message" in chunk and "content" in chunk["message"]:
                                            await websocket.send_json({
                                                "type": "token",
                                                "content": chunk["message"]["content"]
                                            })
                                        if chunk.get("done", False):
                                            await websocket.send_json({"type": "done"})
                                    except json.JSONDecodeError:
                                        pass
                        else:
                            await websocket.send_json({"type": "error", "content": f"Ollama error: {response.status_code}"})
                            await websocket.send_json({"type": "done"})

            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "content": "Invalid JSON request"})
            except httpx.RequestError as e:
                logger.error(f"Error communicating with Ollama: {e}")
                await websocket.send_json({"type": "error", "content": "Failed to communicate with LLM"})
                await websocket.send_json({"type": "done"})

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected.")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.close()
        except:
            pass



@app.get("/api/health")
async def health_check():
    """
    Health check endpoint verifying connectivity to dependent services.
    """
    health_status = {
        "status": "healthy",
        "services": {
            "ollama": False,
            "livekit": False
        }
    }

    # Check Ollama
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{settings.ollama_base_url}/api/tags", timeout=5.0)
            if response.status_code == 200:
                health_status["services"]["ollama"] = True
        except Exception as e:
            logger.warning(f"Ollama health check failed: {e}")
            health_status["status"] = "degraded"

    # Check LiveKit
    if settings.livekit_url and settings.livekit_api_key and settings.livekit_api_secret:
        # A simple check is validating we have the configs. 
        # Making an actual API call to LiveKit would be more robust.
        health_status["services"]["livekit"] = True
    else:
        health_status["status"] = "degraded"

    return health_status
