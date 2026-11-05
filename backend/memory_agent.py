import os
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class MemoryManager:
    """
    Mem0 AI Memory manager wrapper for Rocky.
    Remembers user preferences and facts locally.
    Configurable dynamically via the 'memory_extraction' feature route.
    """
    def __init__(self):
        self.mem0 = None
        self._init_mem0()

    def _init_mem0(self, llm_config: Optional[Dict[str, Any]] = None):
        try:
            from mem0 import Memory
            default_llm = {
                "provider": "ollama",
                "config": {
                    "model": os.getenv("OLLAMA_MODEL", "qwen3.5b"),
                    "ollama_base_url": os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
                }
            }
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
                "llm": llm_config or default_llm
            }
            self.mem0 = Memory.from_config(config)
            logger.info("Mem0 AI Memory Agent initialized successfully.")
        except Exception as e:
            logger.warning(f"Mem0 initialization fallback (running basic storage mode): {e}")

    async def reload_llm_config(self):
        """Reload Mem0 LLM configuration dynamically based on the 'memory_extraction' route."""
        try:
            from database import get_feature_route
            route = await get_feature_route("memory_extraction", include_keys=True)
            if not route:
                return

            p_type = route.get("primary_provider_type", "ollama")
            model = route.get("primary_model") or os.getenv("OLLAMA_MODEL", "qwen3.5b")
            base_url = route.get("primary_base_url", os.getenv("OLLAMA_BASE_URL", "http://ollama:11434"))
            api_key = route.get("primary_api_key")

            if p_type == "ollama":
                llm_cfg = {
                    "provider": "ollama",
                    "config": {
                        "model": model,
                        "ollama_base_url": base_url,
                    }
                }
            elif p_type in ["openai", "groq", "openrouter", "custom_openai"]:
                llm_cfg = {
                    "provider": "openai",
                    "config": {
                        "model": model,
                        "openai_base_url": base_url,
                        "api_key": api_key,
                    }
                }
            elif p_type == "anthropic":
                llm_cfg = {
                    "provider": "anthropic",
                    "config": {
                        "model": model,
                        "api_key": api_key,
                    }
                }
            else:
                llm_cfg = {
                    "provider": "ollama",
                    "config": {
                        "model": model,
                        "ollama_base_url": base_url,
                    }
                }
            self._init_mem0(llm_cfg)
        except Exception as e:
            logger.warning(f"Failed to dynamically reconfigure Mem0 LLM: {e}")

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
