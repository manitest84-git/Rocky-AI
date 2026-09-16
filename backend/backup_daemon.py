import os
import glob
import time
import subprocess
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

BACKUP_DIR = "/app/data/backups"

def ensure_backup_dir():
    if not os.path.exists(BACKUP_DIR):
        try:
            os.makedirs(BACKUP_DIR, exist_ok=True)
        except Exception as e:
            logger.warning(f"ensure_backup_dir notice: {e}")

def trigger_postgresql_backup() -> Dict[str, Any]:
    """Execute pg_dump to produce a compressed SQL backup snapshot."""
    ensure_backup_dir()
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    filename = f"rocky_backup_{timestamp}.sql.gz"
    filepath = os.path.join(BACKUP_DIR, filename)

    host = os.getenv("POSTGRES_HOST", "postgres")
    port = os.getenv("POSTGRES_PORT", "5432")
    db = os.getenv("POSTGRES_DB", "rocky_db")
    user = os.getenv("POSTGRES_USER", "rocky_admin")
    password = os.getenv("POSTGRES_PASSWORD", "rocky_password")

    env = os.environ.copy()
    env["PGPASSWORD"] = password

    # Use pipefail to catch failures in pg_dump
    cmd = f"set -o pipefail; pg_dump -h {host} -p {port} -U {user} -d {db} | gzip > {filepath}"
    try:
        res = subprocess.run(cmd, shell=True, executable="/bin/bash", env=env, capture_output=True, text=True)
        if res.returncode == 0 and os.path.exists(filepath):
            size = os.path.getsize(filepath)
            if size > 100:
                logger.info(f"Database backup created successfully: {filename} ({size} bytes)")
                return {
                    "status": "success",
                    "filename": filename,
                    "size": size,
                    "timestamp": timestamp
                }
            else:
                logger.error(f"Backup file created but too small ({size} bytes)")
                return {"status": "error", "message": f"Backup file too small ({size} bytes)"}
        else:
            logger.error(f"pg_dump error: {res.stderr}")
            return {"status": "error", "message": res.stderr or "pg_dump failed"}
    except Exception as e:
        logger.error(f"Backup exception: {e}")
        return {"status": "error", "message": str(e)}

def get_backup_history() -> List[Dict[str, Any]]:
    """List existing database snapshots and check 7-day liveness status."""
    ensure_backup_dir()
    files = glob.glob(os.path.join(BACKUP_DIR, "*.sql.gz"))
    files.sort(key=os.path.getmtime, reverse=True)

    history = []
    now = time.time()
    for f in files:
        mtime = os.path.getmtime(f)
        size = os.path.getsize(f)
        age_days = (now - mtime) / 86400.0
        history.append({
            "filename": os.path.basename(f),
            "size": size,
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(mtime)),
            "age_days": round(age_days, 1)
        })

    return history

def check_backup_liveness_alert() -> Dict[str, Any]:
    """Check if a backup has occurred in the last 7 days; trigger auto backup if missing."""
    history = get_backup_history()
    if not history:
        logger.warning("No database backups found. Triggering automated initial snapshot...")
        new_backup = trigger_postgresql_backup()
        return {"status": "alert_triggered", "reason": "No backups found", "new_backup": new_backup}

    latest = history[0]
    if latest["age_days"] > 7.0:
        logger.warning(f"Latest database backup is {latest['age_days']} days old. Triggering auto-backup...")
        new_backup = trigger_postgresql_backup()
        return {"status": "alert_triggered", "reason": "Latest backup > 7 days old", "new_backup": new_backup}

    return {"status": "healthy", "latest": latest}
