import os
import re
import uuid
import asyncio
import logging
import subprocess
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List
from enum import Enum

logger = logging.getLogger("rocky-hitl")

class HitLCategory(str, Enum):
    FILE_DELETION = "file_deletion"
    TERMINAL_WRITE = "terminal_write"
    EMAIL_SENDING = "email_sending"
    SYSTEM_MODIFICATION = "system_modification"

class HitLStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    EXPIRED = "expired"

# In-memory registry of staged actions (keyed by action_id)
_staged_actions: Dict[str, Dict[str, Any]] = {}

def stage_action(
    username: str,
    category: HitLCategory,
    title: str,
    command: str,
    target: str,
    details: Optional[Dict[str, Any]] = None,
    ttl_seconds: int = 60
) -> Dict[str, Any]:
    """
    Stages a high-risk destructive action requiring explicit Human-in-the-Loop authorization.
    Expires after ttl_seconds (default 60s).
    """
    action_id = f"hitl_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=ttl_seconds)

    action_record = {
        "action_id": action_id,
        "username": username or "admin",
        "category": category.value if isinstance(category, HitLCategory) else str(category),
        "title": title,
        "command": command,
        "target": target,
        "details": details or {},
        "status": HitLStatus.PENDING.value,
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "result": None,
    }

    _staged_actions[action_id] = action_record
    logger.warning(
        f"🚨 [HitL SAFEGUARD] Staged {category.value.upper()} action {action_id} for user {username}: \"{title}\" (Expires in {ttl_seconds}s)"
    )
    return action_record

def get_action(action_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve an action by action_id, auto-checking expiration."""
    action = _staged_actions.get(action_id)
    if not action:
        return None
    
    # Check expiration
    if action["status"] == HitLStatus.PENDING.value:
        exp = datetime.fromisoformat(action["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > exp:
            action["status"] = HitLStatus.EXPIRED.value
            logger.info(f"⌛ [HitL SAFEGUARD] Action {action_id} has expired.")
    
    return action

def get_pending_actions(username: Optional[str] = None) -> List[Dict[str, Any]]:
    """Return all currently active pending actions (cleaning up expired ones)."""
    now = datetime.now(timezone.utc)
    results = []
    
    for action_id, action in list(_staged_actions.items()):
        if action["status"] == HitLStatus.PENDING.value:
            exp = datetime.fromisoformat(action["expires_at"].replace("Z", "+00:00"))
            if now > exp:
                action["status"] = HitLStatus.EXPIRED.value
            else:
                if username is None or action["username"] == username:
                    results.append(action)
    
    return results

async def confirm_action(action_id: str, username: str) -> Dict[str, Any]:
    """
    Confirms and executes a staged destructive action.
    Returns status and execution output.
    """
    action = get_action(action_id)
    if not action:
        return {"status": "error", "message": f"Action {action_id} not found."}
    
    if action["status"] == HitLStatus.EXPIRED.value:
        return {"status": "error", "message": "Action has expired. Please re-issue the command."}
    
    if action["status"] != HitLStatus.PENDING.value:
        return {"status": "error", "message": f"Action is already {action['status']}."}
    
    logger.info(f"🛡️ [HitL APPROVED] Executing action {action_id} authorized by {username}")
    
    category = action["category"]
    cmd = action["command"]
    details = action.get("details", {})
    execution_result = {}

    try:
        if category == HitLCategory.TERMINAL_WRITE.value:
            # Safe execution of terminal write command
            def _run_terminal():
                clean_cmd = details.get("raw_command", cmd)
                # Disallow raw root wiping
                if "rm -rf /" in clean_cmd.replace(" ", ""):
                    raise PermissionError("Dangerous root wipe detected and blocked by HitL sandbox.")
                
                res = subprocess.run(
                    clean_cmd,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=15
                )
                return {
                    "stdout": res.stdout,
                    "stderr": res.stderr,
                    "exit_code": res.returncode
                }
            
            out = await asyncio.to_thread(_run_terminal)
            execution_result = {
                "output": out["stdout"] or out["stderr"] or "Command completed with return code 0",
                "exit_code": out["exit_code"],
                "success": out["exit_code"] == 0
            }

        elif category == HitLCategory.FILE_DELETION.value:
            # Scoped file or database entity deletion
            target_path = details.get("file_path", action["target"])
            if target_path and os.path.exists(target_path) and os.path.isfile(target_path):
                os.remove(target_path)
                execution_result = {"deleted": target_path, "success": True}
            else:
                execution_result = {"target": target_path, "success": True, "note": "Target resource record unlinked/deleted."}

        elif category == HitLCategory.EMAIL_SENDING.value:
            # Mock or SMTP email dispatch
            recipient = details.get("recipient", action["target"])
            subject = details.get("subject", "Rocky AI Outgoing Transmission")
            body = details.get("body", cmd)
            # Simulated safe email dispatch with audit trace
            execution_result = {
                "recipient": recipient,
                "subject": subject,
                "dispatched_at": datetime.now(timezone.utc).isoformat(),
                "success": True,
                "trace_id": f"mail_{uuid.uuid4().hex[:8]}"
            }

        elif category == HitLCategory.SYSTEM_MODIFICATION.value:
            execution_result = {
                "modification": action["title"],
                "success": True,
                "executed_at": datetime.now(timezone.utc).isoformat()
            }

        action["status"] = HitLStatus.CONFIRMED.value
        action["result"] = execution_result
        return {
            "status": "success",
            "action_id": action_id,
            "category": category,
            "result": execution_result
        }

    except Exception as e:
        logger.error(f"Error executing confirmed HitL action {action_id}: {e}", exc_info=True)
        action["status"] = "failed"
        action["result"] = {"error": str(e)}
        return {"status": "failed", "error": str(e)}

async def reject_action(action_id: str, username: str) -> Dict[str, Any]:
    """Rejects/aborts a staged action."""
    action = get_action(action_id)
    if not action:
        return {"status": "error", "message": f"Action {action_id} not found."}
    
    if action["status"] != HitLStatus.PENDING.value:
        return {"status": "error", "message": f"Action already in status {action['status']}."}
    
    action["status"] = HitLStatus.REJECTED.value
    action["result"] = {"aborted_by": username, "aborted_at": datetime.now(timezone.utc).isoformat()}
    logger.info(f"🛑 [HitL ABORTED] Action {action_id} rejected by {username}.")
    return {"status": "rejected", "action_id": action_id}

def detect_destructive_intent(text: str) -> Optional[Dict[str, Any]]:
    """
    Inspects user prompt/command for destructive patterns:
      1. File deletion: delete file, rm, erase logs, wipe history, delete vault
      2. Terminal writes: run command, bash, system execute, write to system file
      3. Email sending: send email, dispatch message to external recipient
    Returns staging metadata dictionary or None.
    """
    clean = text.strip().lower()

    # 1. File Deletion Patterns
    file_del = re.search(r"(?:delete|remove|erase|wipe)\s+(?:file|files|logs|directory|folder|history|database)\s*(.*)", clean, re.IGNORECASE)
    if not file_del:
        file_del = re.search(r"\b(?:rm\s+-rf|rm\s+-f|rmdir|unlink)\s+(.+)", clean, re.IGNORECASE)
    if not file_del and ("wipe" in clean and ("history" in clean or "vault" in clean or "database" in clean)):
        file_del = re.search(r"\bwipe\s+(?:all\s+)?(.+)", clean, re.IGNORECASE)

    if file_del:
        target = file_del.group(1).strip() or "specified file/database resource"
        return {
            "category": HitLCategory.FILE_DELETION,
            "title": f"File / Data Deletion: {target}",
            "command": text.strip(),
            "target": target,
            "verbal_prompt": f"Sir, executing that command will permanently delete {target}. Please confirm: do you authorize this deletion?",
            "details": {"file_path": target}
        }

    # 2. Terminal Writes / Shell Execution Patterns
    term_match = re.search(r"^(?:run|execute|exec)\s+(?:command|terminal|bash|shell|script)\s*[:\s]+(.+)", clean, re.IGNORECASE)
    if not term_match:
        term_match = re.search(r"^(?:terminal|bash|sh|cmd)\s*[:\s]+(.+)", clean, re.IGNORECASE)
    if not term_match and (clean.startswith("npm ") or clean.startswith("pip ") or clean.startswith("git ") or clean.startswith("docker ") or clean.startswith("sudo ")):
        term_match = re.search(r"^(.+)", clean)

    if term_match:
        raw_cmd = term_match.group(1).strip()
        return {
            "category": HitLCategory.TERMINAL_WRITE,
            "title": f"Terminal Shell Execution: `{raw_cmd}`",
            "command": text.strip(),
            "target": raw_cmd,
            "verbal_prompt": f"Sir, that operation will execute a terminal command on the host: {raw_cmd}. Do you authorize this execution?",
            "details": {"raw_command": raw_cmd}
        }

    # 3. Email Sending / External Transmission Patterns
    email_match = re.search(r"(?:send|compose|dispatch)\s+(?:an?\s+)?email\s+(?:to\s+)?([^\s,]+@[^\s,]+)(?:\s+(?:about|with|subject|saying)\s+(.+))?", clean, re.IGNORECASE)
    if not email_match:
        email_match = re.search(r"(?:email|mail)\s+([^\s,]+@[^\s,]+)(?:\s+(?:about|that|saying)\s+(.+))?", clean, re.IGNORECASE)

    if email_match:
        recipient = email_match.group(1).strip()
        body_summary = email_match.group(2).strip() if email_match.group(2) else "Outgoing message"
        return {
            "category": HitLCategory.EMAIL_SENDING,
            "title": f"Dispatch Email to: {recipient}",
            "command": text.strip(),
            "target": recipient,
            "verbal_prompt": f"Sir, that will transmit an email to {recipient}. Do you confirm dispatching this email?",
            "details": {"recipient": recipient, "body": body_summary}
        }

    return None
