from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class LLMMessage(BaseModel):
    role: str
    content: str

class LLMCompletionRequest(BaseModel):
    messages: List[LLMMessage]
    model: str
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 2048
    stream: bool = False
    tools: Optional[List[Dict[str, Any]]] = None

class LLMCompletionResponse(BaseModel):
    content: str
    model: str
    provider: str
    usage: Optional[Dict[str, int]] = None
    raw_response: Optional[Dict[str, Any]] = None

class LLMStreamChunk(BaseModel):
    content: str
    is_done: bool = False
    error: Optional[str] = None

class ProviderTestResult(BaseModel):
    success: bool
    message: str
    latency_ms: Optional[int] = None
    models_found: List[str] = Field(default_factory=list)

