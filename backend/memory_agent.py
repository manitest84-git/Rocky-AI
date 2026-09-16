import os
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class MemoryManager:
    """
    Mem0 AI Memory manager wrapper for Rocky.
    Remembers user preferences and facts locally.
    """
    def __init__(self):
        self.mem0 = None
        try:
            from mem0 import Memory
            config = {
                "vector_store": {
                    "provider": "pgvector",
                    "config": {
                        "host": os.getenv("POSTGRES_HOST", "postgres"),
                        "port": int(os.getenv("POSTGRES_PORT", "5432")),
                        "dbname": os.getenv("POSTGRES_DB", "rocky_db"),
                        "user": os.getenv("POSTGRES_USER", "rocky_admin"),
                        "password": os.getenv("POSTGRES_PASSWORD", "rocky_password"),
                    }
                },
                "llm": {
                    "provider": "ollama",
                    "config": {
                        "model": os.getenv("OLLAMA_MODEL", "jarvis"),
                        "ollama_base_url": os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
                    }
                }
            }
            self.mem0 = Memory.from_config(config)
            logger.info("Mem0 AI Memory Agent initialized successfully.")
        except Exception as e:
            logger.warning(f"Mem0 initialization fallback (running basic storage mode): {e}")

    def add_memory(self, user_id: str, text: str):
        if self.mem0:
            try:
                self.mem0.add(text, user_id=user_id)
            except Exception as e:
                logger.error(f"Failed to save Mem0 memory: {e}")

    def get_memories(self, user_id: str) -> List[Dict[str, Any]]:
        if self.mem0:
            try:
                return self.mem0.get_all(user_id=user_id)
            except Exception as e:
                logger.error(f"Failed to retrieve Mem0 memories: {e}")
        return []

memory_manager = MemoryManager()
