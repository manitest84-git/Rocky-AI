import os
import time
import logging
from typing import Dict, Any, Optional, List, Union, AsyncIterator

from .models import (
    LLMMessage,
    LLMCompletionRequest,
    LLMCompletionResponse,
    LLMStreamChunk,
    ProviderTestResult,
)
from .adapters import get_adapter, BaseLLMAdapter, OllamaNativeAdapter

logger = logging.getLogger(__name__)

class LLMRouter:
    """
    Cognitive LLM Router for Rocky AI.
    Resolves feature routes, instantiates protocol adapters, manages API keys,
    and handles automatic multi-tier fallback with zero downtime.
    """

    def __init__(self):
        self._route_cache: Dict[str, Dict[str, Any]] = {}
        self._cache_timestamp: Dict[str, float] = {}
        self._cache_ttl = 30.0  # seconds

    def invalidate_cache(self, feature_key: Optional[str] = None):
        """Invalidate route cache for a specific feature or all features."""
        if feature_key:
            self._route_cache.pop(feature_key, None)
            self._cache_timestamp.pop(feature_key, None)
        else:
            self._route_cache.clear()
            self._cache_timestamp.clear()

    async def get_route(self, feature_key: str, force_refresh: bool = False) -> Optional[Dict[str, Any]]:
        """Fetch active route configuration with decrypted API keys."""
        now = time.time()
        if not force_refresh and feature_key in self._route_cache:
            if now - self._cache_timestamp.get(feature_key, 0) < self._cache_ttl:
                return self._route_cache[feature_key]

        try:
            from database import get_feature_route
            route = await get_feature_route(feature_key, include_keys=True)
            if route:
                self._route_cache[feature_key] = route
                self._cache_timestamp[feature_key] = now
            return route
        except Exception as e:
            logger.error(f"Error resolving LLM route for {feature_key}: {e}")
            return None

    def _build_primary_adapter(self, route: Dict[str, Any]) -> BaseLLMAdapter:
        provider_data = {
            "name": route["primary_provider_name"],
            "provider_type": route["primary_provider_type"],
            "base_url": route["primary_base_url"],
            "api_key": route.get("primary_api_key"),
            "default_model": route["primary_model"],
            "timeout_seconds": route.get("primary_timeout_seconds") or 60,
        }
        return get_adapter(provider_data)

    def _build_fallback_adapter(self, route: Dict[str, Any]) -> Optional[BaseLLMAdapter]:
        if not route.get("fallback_provider_id") or not route.get("fallback_base_url"):
            return None
        provider_data = {
            "name": route["fallback_provider_name"],
            "provider_type": route["fallback_provider_type"],
            "base_url": route["fallback_base_url"],
            "api_key": route.get("fallback_api_key"),
            "default_model": route.get("fallback_model"),
            "timeout_seconds": route.get("fallback_timeout_seconds") or 60,
        }
        return get_adapter(provider_data)

    def _get_system_failsafe_adapter(self) -> BaseLLMAdapter:
        """Ultimate fallback to local Ollama if all configured routes fail."""
        ollama_url = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
        ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5:1.5b")
        return OllamaNativeAdapter(
            name="Emergency Local Ollama Failsafe",
            provider_type="ollama",
            base_url=ollama_url,
            default_model=ollama_model,
            timeout=60.0,
        )

    async def execute_chat(
        self,
        feature_key: str,
        messages: List[Dict[str, str]],
        stream: bool = False,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
    ) -> Union[LLMCompletionResponse, AsyncIterator[LLMStreamChunk]]:
        """
        Execute an LLM chat request for a designated application feature.
        Implements automatic multi-tier fallback (Primary -> Secondary -> Emergency Local).
        """
        route = await self.get_route(feature_key)
        llm_messages = [LLMMessage(role=m.get("role", "user"), content=m.get("content", "")) for m in messages]

        # Apply system prompt override if specified
        if route and route.get("system_prompt_override"):
            sys_prompt = route["system_prompt_override"].strip()
            # If already has system message, prepend or replace
            if llm_messages and llm_messages[0].role == "system":
                llm_messages[0].content = f"{sys_prompt}\n\n{llm_messages[0].content}"
            else:
                llm_messages.insert(0, LLMMessage(role="system", content=sys_prompt))

        # Determine effective parameters
        eff_temp = temperature if temperature is not None else (route.get("temperature_override") if route else 0.7)
        eff_max_tokens = max_tokens if max_tokens is not None else (route.get("max_tokens_override") if route else None)

        # 1. Attempt Primary Provider
        primary_adapter = None
        primary_model = os.getenv("OLLAMA_MODEL", "qwen2.5:1.5b")
        if route:
            primary_adapter = self._build_primary_adapter(route)
            primary_model = route.get("primary_model") or primary_adapter.default_model or os.getenv("OLLAMA_MODEL", "qwen2.5:1.5b")
        else:
            primary_adapter = self._get_system_failsafe_adapter()

        request = LLMCompletionRequest(
            messages=llm_messages,
            model=primary_model,
            temperature=float(eff_temp) if eff_temp is not None else 0.7,
            max_tokens=int(eff_max_tokens) if eff_max_tokens is not None else None,
            stream=stream,
            tools=tools,
        )

        if not stream:
            # Non-streaming execution with try-catch fallback
            try:
                return await primary_adapter.complete(request)
            except Exception as e_primary:
                logger.warning(
                    f"⚠️ [LLM Router] Primary provider '{primary_adapter.name}' failed for feature '{feature_key}': {e_primary}. Attempting fallback..."
                )
                # Attempt configured fallback provider
                fallback_adapter = self._build_fallback_adapter(route) if route else None
                if fallback_adapter:
                    try:
                        fallback_model = route.get("fallback_model") or fallback_adapter.default_model or primary_model
                        request.model = fallback_model
                        return await fallback_adapter.complete(request)
                    except Exception as e_fallback:
                        logger.warning(
                            f"⚠️ [LLM Router] Fallback provider '{fallback_adapter.name}' also failed for '{feature_key}': {e_fallback}. Attempting emergency failsafe..."
                        )

                # Emergency failsafe (Local Ollama)
                failsafe = self._get_system_failsafe_adapter()
                request.model = failsafe.default_model or os.getenv("OLLAMA_MODEL", "qwen2.5:1.5b")
                return await failsafe.complete(request)

        else:
            # Streaming execution with generator fallback
            return self._stream_with_fallback(route, primary_adapter, request, feature_key)

    async def _stream_with_fallback(
        self,
        route: Optional[Dict[str, Any]],
        primary_adapter: BaseLLMAdapter,
        request: LLMCompletionRequest,
        feature_key: str,
    ) -> AsyncIterator[LLMStreamChunk]:
        """Stream chunks with generator-level fallback on connection failure."""
        primary_failed = False
        chunks_yielded = 0

        try:
            async for chunk in primary_adapter.stream(request):
                if chunk.error:
                    primary_failed = True
                    break
                chunks_yielded += 1
                yield chunk
        except Exception as e:
            logger.warning(f"⚠️ [LLM Router] Primary stream failed for '{feature_key}': {e}")
            primary_failed = True

        if not primary_failed or chunks_yielded > 0:
            return

        # Attempt fallback provider if primary yielded 0 tokens
        fallback_adapter = self._build_fallback_adapter(route) if route else None
        if fallback_adapter:
            logger.info(f"🔄 [LLM Router] Falling back to '{fallback_adapter.name}' for feature '{feature_key}'")
            try:
                fallback_model = route.get("fallback_model") or fallback_adapter.default_model or request.model
                request.model = fallback_model
                async for chunk in fallback_adapter.stream(request):
                    if chunk.error:
                        break
                    chunks_yielded += 1
                    yield chunk
                if chunks_yielded > 0:
                    return
            except Exception as e_fb:
                logger.warning(f"⚠️ [LLM Router] Fallback stream failed for '{feature_key}': {e_fb}")

        # Emergency failsafe
        logger.info(f"🚨 [LLM Router] Engaging emergency local failsafe for '{feature_key}'")
        failsafe = self._get_system_failsafe_adapter()
        request.model = failsafe.default_model or os.getenv("OLLAMA_MODEL", "qwen2.5:1.5b")
        try:
            async for chunk in failsafe.stream(request):
                yield chunk
        except Exception as e_fail:
            yield LLMStreamChunk(content="", is_done=True, error=f"All LLM providers failed for {feature_key}: {e_fail}")

    async def test_provider(self, provider_data: Dict[str, Any]) -> ProviderTestResult:
        """Run connectivity ping test on a provider configuration."""
        adapter = get_adapter(provider_data)
        return await adapter.test_connection()

    async def fetch_models(self, provider_data: Dict[str, Any]) -> List[str]:
        """Fetch live list of available models from a provider."""
        adapter = get_adapter(provider_data)
        return await adapter.fetch_models()


# Global Singleton Instance
llm_router = LLMRouter()

