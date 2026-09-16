import json
import logging
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx

from livekit import api

from config import settings

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Jarvis AI Backend")

from fastapi import Request
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
async def get_history(limit: int = 10, offset: int = 0, current_user: dict = Depends(get_current_user)):
    """Fetch paginated isolated conversation history for current authenticated user."""
    res = await get_user_conversation_history(current_user["id"], limit=limit, offset=offset)
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


@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    """
    Stream a chat response from Ollama, using user-isolated conversation memory stored in SQLite.
    """
    # Fetch isolated past conversation turns for this user
    history_data = await get_user_conversation_history(current_user["id"], limit=15)
    past_history = history_data.get("messages", []) if isinstance(history_data, dict) else history_data
    
    # Save the new user prompt
    await save_conversation_turn(current_user["id"], "user", request.message)

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
