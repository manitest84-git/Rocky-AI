import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any

from database import get_pg_pool
from backup_daemon import check_backup_liveness_alert

logger = logging.getLogger(__name__)

proactive_alerts_cache: List[Dict[str, Any]] = []

async def audit_proactive_system_alerts() -> List[Dict[str, Any]]:
    """Audit database state for upcoming task deadlines, calendar events, bills due, and backup status."""
    alerts: List[Dict[str, Any]] = []
    
    try:
        p = await get_pg_pool()
        async with p.acquire() as conn:
            # 1. Database Backup Age Check — only alert if status is not healthy
            backup_alert = check_backup_liveness_alert()
            if backup_alert and backup_alert.get("status") != "healthy":
                reason = backup_alert.get("reason", "Backup status requires attention")
                alerts.append({
                    "id": "backup_alert",
                    "category": "Security & Backup",
                    "level": "warning",
                    "title": "Database Backup Alert",
                    "message": f"System Notice: {reason}. An automated backup has been triggered.",
                    "timestamp": datetime.now().isoformat()
                })
                
            # 2. Upcoming High Priority Tasks (Due in next 24 hours)
            tasks = await conn.fetch("""
                SELECT id, title, priority, due_date 
                FROM user_tasks 
                WHERE is_completed = FALSE AND due_date IS NOT NULL AND due_date <= NOW() + INTERVAL '24 hours'
                ORDER BY due_date ASC;
            """)
            for t in tasks:
                alerts.append({
                    "id": f"task_{t['id']}",
                    "category": "Productivity",
                    "level": "info" if t["priority"] in ("P3", "P4") else "warning",
                    "title": f"Task Deadline Approaching [{t['priority']}]",
                    "message": f"'{t['title']}' is due soon ({t['due_date'].strftime('%b %d, %H:%M')}).",
                    "timestamp": datetime.now().isoformat()
                })
                
            # 3. Upcoming Calendar Events (Next 3 hours)
            events = await conn.fetch("""
                SELECT id, title, start_time, location 
                FROM calendar_events 
                WHERE start_time >= NOW() AND start_time <= NOW() + INTERVAL '3 hours'
                ORDER BY start_time ASC;
            """)
            for e in events:
                loc_str = f" at {e['location']}" if e.get("location") else ""
                alerts.append({
                    "id": f"event_{e['id']}",
                    "category": "Schedule",
                    "level": "info",
                    "title": "Upcoming Meeting / Event",
                    "message": f"'{e['title']}' starts at {e['start_time'].strftime('%H:%M')}{loc_str}.",
                    "timestamp": datetime.now().isoformat()
                })
                
            # 4. Recurring Subscription Bills Due (Next 3 days)
            subs = await conn.fetch("""
                SELECT id, service_name, amount, next_billing_date 
                FROM user_subscriptions 
                WHERE is_active = TRUE AND next_billing_date <= CURRENT_DATE + INTERVAL '3 days';
            """)
            for s in subs:
                alerts.append({
                    "id": f"sub_{s['id']}",
                    "category": "Finance",
                    "level": "warning",
                    "title": "Subscription Billing Due",
                    "message": f"Recurring bill for {s['service_name']} (₹{float(s['amount']):,.2f}) is due on {s['next_billing_date'].strftime('%b %d')}.",
                    "timestamp": datetime.now().isoformat()
                })
                
    except Exception as err:
        logger.error(f"Error auditing proactive alerts: {err}")
        
    global proactive_alerts_cache
    proactive_alerts_cache = alerts
    return alerts

async def proactive_daemon_loop():
    """Background async loop running proactive system audits every 60 seconds."""
    logger.info("Starting Jarvis Proactive Assistant Daemon...")
    while True:
        try:
            await audit_proactive_system_alerts()
        except Exception as e:
            logger.error(f"Proactive daemon loop error: {e}")
        await asyncio.sleep(60)
