import os
import sys
import asyncio
import json
import time

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.environ.setdefault("POSTGRES_HOST", "127.0.0.1")
os.environ.setdefault("POSTGRES_PORT", "5432")
os.environ.setdefault("POSTGRES_DB", "rocky_db")
os.environ.setdefault("POSTGRES_USER", "rocky_admin")
os.environ.setdefault("POSTGRES_PASSWORD", "rocky_password")
os.environ.setdefault("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
os.environ.setdefault("OLLAMA_MODEL", "qwen2.5:1.5b")

import database
from database import (
    init_db,
    get_pg_pool,
    get_all_llm_providers,
    get_llm_provider_by_id,
    create_llm_provider,
    update_llm_provider,
    delete_llm_provider,
    get_all_feature_routes,
    get_feature_route,
    update_feature_route
)
from llm_engine import llm_router


async def run_all_tests():
    print("=" * 60)
    print("🚀 RUNNING PHASE 3 & PHASE 4 VERIFICATION TEST SUITE")
    print("=" * 60)

    # Setup
    await init_db()
    p = await get_pg_pool()
    async with p.acquire() as conn:
        await conn.execute("UPDATE llm_providers SET default_model = 'qwen2.5:1.5b', base_url = 'http://127.0.0.1:11434', timeout_seconds = 60 WHERE is_system = TRUE;")
        await conn.execute("UPDATE llm_feature_routes SET primary_model = 'qwen2.5:1.5b';")
    llm_router.invalidate_cache()

    # Test 1: Provider listing & system provider
    print("\n[TEST 1] Listing LLM providers...")
    providers = await get_all_llm_providers(include_keys=False)
    assert len(providers) >= 1, "Expected at least 1 provider"
    sys_p = next(p for p in providers if p.get("is_system"))
    assert sys_p["provider_type"] == "ollama"
    print(f"✅ Found {len(providers)} providers. System default: {sys_p['name']} ({sys_p['default_model']})")

    # Test 2: Provider connectivity ping
    print("\n[TEST 2] Testing provider connection ping (Local Ollama)...")
    ping_result = await llm_router.test_provider({
        "name": "Local Ollama",
        "provider_type": "ollama",
        "base_url": "http://127.0.0.1:11434",
        "default_model": "qwen2.5:1.5b",
        "timeout_seconds": 10
    })
    assert ping_result.success, f"Ping failed: {ping_result.message}"
    assert ping_result.latency_ms is not None
    print(f"✅ Ping successful: latency={ping_result.latency_ms}ms, models={ping_result.models_found}")

    # Test 3: Provider CRUD lifecycle & Key Encryption
    print("\n[TEST 3] Testing provider CRUD lifecycle & key encryption...")
    created = await create_llm_provider(
        name="Groq Ultra Speed (Test)",
        provider_type="groq",
        base_url="https://api.groq.com/openai/v1",
        default_model="llama-3.3-70b-versatile",
        api_key="gsk_1234567890abcdefghijklmnopqrst",
        temperature=0.6,
        max_tokens=4096
    )
    p_id = created["id"]
    assert "••••••••" in created["api_key"], "API key must be masked in returned record"
    assert created["has_api_key"] is True
    print(f"✅ Created provider #{p_id} with masked key: {created['api_key']}")

    # Read with decrypted key
    decrypted = await get_llm_provider_by_id(p_id, include_key=True)
    assert decrypted["api_key"] == "gsk_1234567890abcdefghijklmnopqrst", "Decrypted key must match plaintext"
    print(f"✅ Decrypted key verified at rest: {decrypted['api_key'][:7]}...")

    # Update
    updated = await update_llm_provider(p_id, {"temperature": 0.3, "default_model": "llama-3.1-8b-instant"})
    assert float(updated["temperature"]) == 0.3
    assert updated["default_model"] == "llama-3.1-8b-instant"
    print(f"✅ Updated provider #{p_id}")

    # Delete
    del_res = await delete_llm_provider(p_id)
    assert del_res["success"] is True
    print(f"✅ Deleted provider #{p_id}")

    # Delete system provider must be rejected
    del_sys = await delete_llm_provider(sys_p["id"])
    assert del_sys["success"] is False
    print(f"✅ System provider deletion guard verified: {del_sys['error']}")

    # Test 4: Feature Routes
    print("\n[TEST 4] Verifying 8 cognitive feature routes...")
    routes = await get_all_feature_routes(include_keys=False)
    assert len(routes) == 8, f"Expected 8 routes, got {len(routes)}"
    keys = [r["feature_key"] for r in routes]
    expected = [
        "voice_agent", "chat_text", "intent_action_dispatch", "hitl_safety_guardrail",
        "memory_extraction", "calendar_agenda_generation", "daily_briefing_synthesis", "study_matrix_quiz"
    ]
    for exp in expected:
        assert exp in keys, f"Missing route {exp}"
    print(f"✅ All 8 feature routes confirmed: {keys}")

    # Test 5: Route execution (chat_text)
    print("\n[TEST 5] Testing route execution ('chat_text')...")
    resp = await llm_router.execute_chat(
        feature_key="chat_text",
        messages=[{"role": "user", "content": "Respond with the single word 'Ready'."}],
        max_tokens=15,
        stream=False
    )
    assert resp.content and len(resp.content.strip()) > 0
    print(f"✅ Chat execution: provider='{resp.provider}', model='{resp.model}', reply='{resp.content.strip()}'")

    # Test 6: Streaming Chat Execution
    print("\n[TEST 6] Testing streaming chat execution ('chat_text')...")
    stream_iter = await llm_router.execute_chat(
        feature_key="chat_text",
        messages=[{"role": "user", "content": "Count from 1 to 3."}],
        max_tokens=20,
        stream=True
    )
    tokens = []
    async for chunk in stream_iter:
        if chunk.content:
            tokens.append(chunk.content)
        if chunk.is_done:
            break
    streamed_text = "".join(tokens)
    assert len(tokens) > 0, "Expected streamed tokens"
    print(f"✅ Streaming chat ({len(tokens)} chunks): '{streamed_text.strip()}'")

    # Test 7: Calendar Agenda Generation Feature
    print("\n[TEST 7] Testing calendar agenda generation ('calendar_agenda_generation')...")
    agenda_resp = await llm_router.execute_chat(
        feature_key="calendar_agenda_generation",
        messages=[{"role": "user", "content": "List 2 brief items for 'Sprint Planning'."}],
        max_tokens=25,
        stream=False
    )
    assert agenda_resp.content and len(agenda_resp.content.strip()) > 3
    print(f"✅ Agenda generated ({len(agenda_resp.content)} chars):\n{agenda_resp.content.strip()[:150]}...")

    # Cleanup pool
    if database.pool:
        await database.pool.close()
        database.pool = None

    print("\n" + "=" * 60)
    print("🎉 ALL PHASE 3 & PHASE 4 TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_all_tests())
