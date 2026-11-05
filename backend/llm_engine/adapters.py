import time
import json
import logging
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, AsyncIterator
import httpx

from .models import (
    LLMCompletionRequest,
    LLMCompletionResponse,
    LLMStreamChunk,
    ProviderTestResult,
)

logger = logging.getLogger(__name__)

class BaseLLMAdapter(ABC):
    """Abstract base class for all LLM provider communication protocols."""

    def __init__(
        self,
        name: str,
        provider_type: str,
        base_url: str,
        api_key: Optional[str] = None,
        timeout: float = 30.0,
        default_model: Optional[str] = None,
    ):
        self.name = name
        self.provider_type = provider_type.lower().strip()
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key.strip() if api_key else None
        self.timeout = timeout
        self.default_model = default_model

    @abstractmethod
    async def complete(self, request: LLMCompletionRequest) -> LLMCompletionResponse:
        """Execute a non-streaming chat completion request."""
        pass

    @abstractmethod
    async def stream(self, request: LLMCompletionRequest) -> AsyncIterator[LLMStreamChunk]:
        """Execute a streaming chat completion yielding text chunks."""
        pass

    @abstractmethod
    async def test_connection(self) -> ProviderTestResult:
        """Perform a live ping test to evaluate latency and connectivity."""
        pass

    @abstractmethod
    async def fetch_models(self) -> List[str]:
        """Query available models from the provider endpoint."""
        pass


class OpenAICompatibleAdapter(BaseLLMAdapter):
    """
    Standard OpenAI-compatible protocol adapter.
    Compatible with: OpenAI, Groq, OpenRouter, DeepSeek, vLLM, LocalAI, and Ollama /v1.
    """

    def _get_chat_url(self) -> str:
        url = self.base_url
        if "/chat/completions" in url:
            return url
        if url.endswith("/v1"):
            return f"{url}/chat/completions"
        return f"{url}/v1/chat/completions"

    def _get_models_url(self) -> str:
        url = self.base_url
        if "/models" in url:
            return url
        if url.endswith("/v1"):
            return f"{url}/models"
        return f"{url}/v1/models"

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        if "openrouter" in self.base_url or self.provider_type == "openrouter":
            headers["HTTP-Referer"] = "https://rocky.local"
            headers["X-Title"] = "Rocky AI Platform"
        return headers

    async def complete(self, request: LLMCompletionRequest) -> LLMCompletionResponse:
        url = self._get_chat_url()
        headers = self._get_headers()
        payload = {
            "model": request.model or self.default_model,
            "messages": [{"role": m.role, "content": m.content} for m in request.messages],
            "temperature": request.temperature,
            "stream": False,
        }
        if request.max_tokens:
            payload["max_tokens"] = request.max_tokens

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code != 200:
                raise RuntimeError(f"OpenAI protocol error ({resp.status_code}): {resp.text}")
            data = resp.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            return LLMCompletionResponse(
                content=content,
                model=request.model or self.default_model or "",
                provider=self.name,
                usage=data.get("usage"),
                raw_response=data,
            )

    async def stream(self, request: LLMCompletionRequest) -> AsyncIterator[LLMStreamChunk]:
        url = self._get_chat_url()
        headers = self._get_headers()
        payload = {
            "model": request.model or self.default_model,
            "messages": [{"role": m.role, "content": m.content} for m in request.messages],
            "temperature": request.temperature,
            "stream": True,
        }
        if request.max_tokens:
            payload["max_tokens"] = request.max_tokens

        async with httpx.AsyncClient(timeout=httpx.Timeout(self.timeout, connect=10.0)) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as response:
                if response.status_code != 200:
                    err_body = await response.aread()
                    yield LLMStreamChunk(content="", is_done=True, error=f"HTTP {response.status_code}: {err_body.decode('utf-8')}")
                    return

                async for line in response.aiter_lines():
                    if not line:
                        continue
                    line = line.strip()
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            yield LLMStreamChunk(content="", is_done=True)
                            return
                        try:
                            chunk = json.loads(data_str)
                            choices = chunk.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                text = delta.get("content", "")
                                if text:
                                    yield LLMStreamChunk(content=text, is_done=False)
                        except json.JSONDecodeError:
                            logger.debug(f"Non-JSON SSE chunk: {line}")

        yield LLMStreamChunk(content="", is_done=True)

    async def test_connection(self) -> ProviderTestResult:
        start_time = time.perf_counter()
        try:
            models = await self.fetch_models()
            latency = int((time.perf_counter() - start_time) * 1000)
            return ProviderTestResult(
                success=True,
                message=f"Connected successfully. Retrieved {len(models)} models in {latency}ms.",
                latency_ms=latency,
                models_found=models[:25],
            )
        except Exception as e:
            try:
                # If /models endpoint is disabled/unauthorized, test with minimal 1-token prompt
                test_req = LLMCompletionRequest(
                    messages=[{"role": "user", "content": "ping"}],
                    model=self.default_model or "gpt-4o-mini",
                    max_tokens=1,
                    temperature=0.0,
                )
                await self.complete(test_req)
                latency = int((time.perf_counter() - start_time) * 1000)
                return ProviderTestResult(
                    success=True,
                    message=f"Chat ping succeeded in {latency}ms.",
                    latency_ms=latency,
                    models_found=[self.default_model] if self.default_model else [],
                )
            except Exception as e2:
                return ProviderTestResult(
                    success=False,
                    message=f"Connection failed: {str(e2)}",
                )

    async def fetch_models(self) -> List[str]:
        url = self._get_models_url()
        headers = self._get_headers()
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                raw_list = data.get("data", [])
                if isinstance(raw_list, list):
                    models = [m.get("id") for m in raw_list if isinstance(m, dict) and m.get("id")]
                    return sorted(models)
            raise RuntimeError(f"Failed to fetch models from {url}: HTTP {resp.status_code}")


class OllamaNativeAdapter(BaseLLMAdapter):
    """
    Direct protocol adapter for Ollama native endpoints (/api/chat, /api/tags).
    Optimized for local Ollama instances on host or Docker.
    """

    async def complete(self, request: LLMCompletionRequest) -> LLMCompletionResponse:
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": request.model or self.default_model,
            "messages": [{"role": m.role, "content": m.content} for m in request.messages],
            "stream": False,
            "options": {"temperature": request.temperature},
        }
        if request.max_tokens:
            payload["options"]["num_predict"] = request.max_tokens

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"Ollama native error ({resp.status_code}): {resp.text}")
            data = resp.json()
            content = data.get("message", {}).get("content", "")
            return LLMCompletionResponse(
                content=content,
                model=request.model or self.default_model or "",
                provider=self.name,
                raw_response=data,
            )

    async def stream(self, request: LLMCompletionRequest) -> AsyncIterator[LLMStreamChunk]:
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": request.model or self.default_model,
            "messages": [{"role": m.role, "content": m.content} for m in request.messages],
            "stream": True,
            "options": {"temperature": request.temperature},
        }
        if request.max_tokens:
            payload["options"]["num_predict"] = request.max_tokens

        async with httpx.AsyncClient(timeout=httpx.Timeout(self.timeout, connect=10.0)) as client:
            async with client.stream("POST", url, json=payload) as response:
                if response.status_code != 200:
                    err_body = await response.aread()
                    yield LLMStreamChunk(content="", is_done=True, error=f"HTTP {response.status_code}: {err_body.decode('utf-8')}")
                    return

                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        content = data.get("message", {}).get("content", "")
                        is_done = data.get("done", False)
                        if content:
                            yield LLMStreamChunk(content=content, is_done=is_done)
                        if is_done:
                            yield LLMStreamChunk(content="", is_done=True)
                            return
                    except json.JSONDecodeError:
                        logger.debug(f"Non-JSON Ollama chunk: {line}")

        yield LLMStreamChunk(content="", is_done=True)

    async def test_connection(self) -> ProviderTestResult:
        start_time = time.perf_counter()
        try:
            models = await self.fetch_models()
            latency = int((time.perf_counter() - start_time) * 1000)
            return ProviderTestResult(
                success=True,
                message=f"Connected to Ollama. {len(models)} models available in {latency}ms.",
                latency_ms=latency,
                models_found=models,
            )
        except Exception as e:
            return ProviderTestResult(
                success=False,
                message=f"Ollama connection error: {str(e)}",
            )

    async def fetch_models(self) -> List[str]:
        url = f"{self.base_url}/api/tags"
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                models = [m.get("name") for m in data.get("models", []) if m.get("name")]
                return sorted(models)
            raise RuntimeError(f"Ollama /api/tags failed with status {resp.status_code}")


class AnthropicAdapter(BaseLLMAdapter):
    """
    Protocol adapter for Anthropic Claude models via /v1/messages.
    """

    def _get_messages_url(self) -> str:
        url = self.base_url
        if "/messages" in url:
            return url
        if url.endswith("/v1"):
            return f"{url}/messages"
        return f"{url}/v1/messages"

    def _get_headers(self) -> Dict[str, str]:
        return {
            "x-api-key": self.api_key or "",
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }

    async def complete(self, request: LLMCompletionRequest) -> LLMCompletionResponse:
        url = self._get_messages_url()
        headers = self._get_headers()

        system_prompt = ""
        user_messages = []
        for m in request.messages:
            if m.role == "system":
                system_prompt += f"{m.content}\n"
            else:
                user_messages.append({"role": m.role, "content": m.content})

        payload = {
            "model": request.model or self.default_model or "claude-3-5-haiku-20241022",
            "messages": user_messages,
            "max_tokens": request.max_tokens or 2048,
            "temperature": request.temperature,
        }
        if system_prompt.strip():
            payload["system"] = system_prompt.strip()

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code != 200:
                raise RuntimeError(f"Anthropic API error ({resp.status_code}): {resp.text}")
            data = resp.json()
            content_blocks = data.get("content", [])
            content = "".join([b.get("text", "") for b in content_blocks if b.get("type") == "text"])
            return LLMCompletionResponse(
                content=content,
                model=request.model or self.default_model or "",
                provider=self.name,
                usage=data.get("usage"),
                raw_response=data,
            )

    async def stream(self, request: LLMCompletionRequest) -> AsyncIterator[LLMStreamChunk]:
        url = self._get_messages_url()
        headers = self._get_headers()

        system_prompt = ""
        user_messages = []
        for m in request.messages:
            if m.role == "system":
                system_prompt += f"{m.content}\n"
            else:
                user_messages.append({"role": m.role, "content": m.content})

        payload = {
            "model": request.model or self.default_model or "claude-3-5-haiku-20241022",
            "messages": user_messages,
            "max_tokens": request.max_tokens or 2048,
            "temperature": request.temperature,
            "stream": True,
        }
        if system_prompt.strip():
            payload["system"] = system_prompt.strip()

        async with httpx.AsyncClient(timeout=httpx.Timeout(self.timeout, connect=10.0)) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as response:
                if response.status_code != 200:
                    err_body = await response.aread()
                    yield LLMStreamChunk(content="", is_done=True, error=f"HTTP {response.status_code}: {err_body.decode('utf-8')}")
                    return

                async for line in response.aiter_lines():
                    if not line:
                        continue
                    line = line.strip()
                    if line.startswith("data: "):
                        try:
                            event_data = json.loads(line[6:])
                            event_type = event_data.get("type")
                            if event_type == "content_block_delta":
                                delta = event_data.get("delta", {})
                                text = delta.get("text", "")
                                if text:
                                    yield LLMStreamChunk(content=text, is_done=False)
                            elif event_type == "message_stop":
                                yield LLMStreamChunk(content="", is_done=True)
                                return
                        except json.JSONDecodeError:
                            pass

        yield LLMStreamChunk(content="", is_done=True)

    async def test_connection(self) -> ProviderTestResult:
        start_time = time.perf_counter()
        try:
            req = LLMCompletionRequest(
                messages=[{"role": "user", "content": "ping"}],
                model=self.default_model or "claude-3-5-haiku-20241022",
                max_tokens=1,
            )
            await self.complete(req)
            latency = int((time.perf_counter() - start_time) * 1000)
            return ProviderTestResult(
                success=True,
                message=f"Connected to Anthropic API in {latency}ms.",
                latency_ms=latency,
                models_found=[
                    "claude-3-5-sonnet-20241022",
                    "claude-3-5-haiku-20241022",
                    "claude-3-opus-20240229",
                ],
            )
        except Exception as e:
            return ProviderTestResult(
                success=False,
                message=f"Anthropic error: {str(e)}",
            )

    async def fetch_models(self) -> List[str]:
        return [
            "claude-3-5-sonnet-20241022",
            "claude-3-5-haiku-20241022",
            "claude-3-opus-20240229",
        ]


def get_adapter(provider_data: Dict[str, Any]) -> BaseLLMAdapter:
    """Factory creating the appropriate adapter based on provider_type."""
    ptype = provider_data.get("provider_type", "").lower().strip()
    name = provider_data.get("name", "Unnamed Provider")
    base_url = provider_data.get("base_url", "")
    api_key = provider_data.get("api_key")
    timeout = float(provider_data.get("timeout_seconds", 30))
    default_model = provider_data.get("default_model")

    if ptype == "ollama":
        # Native Ollama adapter
        return OllamaNativeAdapter(
            name=name,
            provider_type=ptype,
            base_url=base_url,
            api_key=api_key,
            timeout=timeout,
            default_model=default_model,
        )
    elif ptype == "anthropic":
        return AnthropicAdapter(
            name=name,
            provider_type=ptype,
            base_url=base_url or "https://api.anthropic.com/v1",
            api_key=api_key,
            timeout=timeout,
            default_model=default_model or "claude-3-5-haiku-20241022",
        )
    elif ptype == "gemini":
        # Google Gemini via OpenAI-compatible endpoint
        gemini_url = base_url or "https://generativelanguage.googleapis.com/v1beta/openai"
        return OpenAICompatibleAdapter(
            name=name,
            provider_type=ptype,
            base_url=gemini_url,
            api_key=api_key,
            timeout=timeout,
            default_model=default_model or "gemini-1.5-flash",
        )
    else:
        # Default to OpenAI-compatible for openai, groq, openrouter, custom_openai, vllm, deepseek
        return OpenAICompatibleAdapter(
            name=name,
            provider_type=ptype,
            base_url=base_url,
            api_key=api_key,
            timeout=timeout,
            default_model=default_model,
        )

