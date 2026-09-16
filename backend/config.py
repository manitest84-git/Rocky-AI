import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    """
    Application settings for the Jarvis AI backend.
    Loads from environment variables or a .env file.
    """
    livekit_url: str = Field(default="", env="LIVEKIT_URL")
    livekit_api_key: str = Field(default="", env="LIVEKIT_API_KEY")
    livekit_api_secret: str = Field(default="", env="LIVEKIT_API_SECRET")
    
    ollama_base_url: str = Field(default="http://localhost:11434", env="OLLAMA_BASE_URL")
    ollama_model: str = Field(default="jarvis", env="OLLAMA_MODEL")
    
    backend_port: int = Field(default=8333, env="BACKEND_PORT")
    
    # Remote IP Security & CORS Access
    allowed_hosts: str = Field(default="*", env="ALLOWED_HOSTS")
    allowed_origins: str = Field(default="*", env="ALLOWED_ORIGINS")

    @property
    def validated_ollama_base_url(self) -> str:
        """
        Guardrail: Ensure Ollama URL strictly points to local host or docker network.
        Prevents redirection to external/cloud LLM APIs.
        """
        url = self.ollama_base_url.lower()
        allowed_prefixes = ("http://localhost", "http://127.0.0.1", "http://ollama", "http://host.docker.internal")
        if not any(url.startswith(prefix) for prefix in allowed_prefixes):
            raise ValueError(f"GUARDRAIL SECURITY VIOLATION: OLLAMA_BASE_URL ({self.ollama_base_url}) must be a local URL.")
        return self.ollama_base_url

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
