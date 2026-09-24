from __future__ import annotations
from typing import Optional, Any, Dict, List, Tuple, Callable
import os
import io
import asyncio
import logging
import json
import re
import aiohttp
from datetime import datetime, timedelta
from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import AgentSession, Agent, JobContext, JobProcess, WorkerOptions, cli, stt, tts, llm
from livekit.agents.llm import function_tool
from livekit.agents.stt import STTCapabilities, SpeechEvent, SpeechEventType, SpeechData
from livekit.agents.voice import room_io
from livekit.agents.voice.turn import TurnHandlingOptions, InterruptionOptions
from livekit.agents.voice.endpointing import EndpointingOptions
from livekit.plugins import openai, silero
from faster_whisper import WhisperModel
from stt_service import start_stt_microservice
from wakeword import WakeWordEngine

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("rocky-agent")

async def _broadcast_voice_control(ctx: JobContext, event_type: str, details: dict = None):
    """
    Broadcast high-priority real-time voice control events (barge-in, state, wake-up) to HUD.
    """
    try:
        payload = json.dumps({
            "type": event_type,
            "timestamp": datetime.now().isoformat(),
            **(details or {})
        }).encode("utf-8")
        await ctx.room.local_participant.publish_data(payload, reliable=True, topic="voice_control")
    except Exception as e:
        logger.warning(f"Failed to publish voice_control packet: {e}")


async def _broadcast_and_save_transcript(ctx: JobContext, role: str, text: str):
    """
    Broadcast voice transcript to room data channel and persist turn to PostgreSQL history.
    """
    if not text or not text.strip():
        return
    clean_text = text.strip()

    # 1. Publish real-time data channel packet to the room
    try:
        payload = json.dumps({
            "type": "transcript",
            "role": role,
            "text": clean_text,
            "timestamp": datetime.now().isoformat()
        }).encode("utf-8")
        await ctx.room.local_participant.publish_data(payload, reliable=True, topic="transcript")
    except Exception as e:
        logger.warning(f"Failed to publish transcript to room data channel: {e}")

    # 2. Persist turn to backend database history
    try:
        username = "admin"
        if ctx.room.remote_participants:
            first_p = next(iter(ctx.room.remote_participants.values()))
            username = first_p.identity or first_p.name or "admin"
        
        backend_url = os.getenv("INTERNAL_API_URL", "http://api:8333")
        async with aiohttp.ClientSession() as http_sess:
            async with http_sess.post(
                f"{backend_url}/api/voice/transcript",
                json={"username": username, "role": role, "content": clean_text},
                timeout=aiohttp.ClientTimeout(total=3.0)
            ) as resp:
                if resp.status != 200:
                    logger.warning(f"Backend returned status {resp.status} saving voice transcript")
    except Exception as e:
        logger.warning(f"Could not persist voice transcript to backend: {e}")

class FasterWhisperSTT(stt.STT):
    """
    In-process high-speed local STT using faster-whisper without external network calls.
    """
    def __init__(self, model_size="base.en", device="cpu", compute_type="int8"):
        super().__init__(capabilities=STTCapabilities(streaming=False, interim_results=False))
        logger.info(f"Loading local Faster-Whisper STT model ({model_size})...")
        self._model = WhisperModel(model_size, device=device, compute_type=compute_type)
        self._model_size = model_size
        logger.info(f"Local Faster-Whisper STT ({model_size}) ready.")

    @property
    def model(self) -> str:
        return f"faster-whisper-{self._model_size}"

    @property
    def provider(self) -> str:
        return "faster-whisper-local"

    async def _recognize_impl(
        self,
        buffer,
        *,
        language=None,
        conn_options=None,
    ) -> SpeechEvent:
        if not buffer:
            return SpeechEvent(
                type=SpeechEventType.FINAL_TRANSCRIPT,
                alternatives=[SpeechData(text="", language="en")]
            )
        try:
            combined = rtc.combine_audio_frames(buffer)
            wav_bytes = combined.to_wav_bytes()
        except Exception as e:
            logger.warning(f"Audio buffer combination notice: {e}")
            return SpeechEvent(
                type=SpeechEventType.FINAL_TRANSCRIPT,
                alternatives=[SpeechData(text="", language="en")]
            )

        def _transcribe():
            try:
                segments, info = self._model.transcribe(
                    io.BytesIO(wav_bytes),
                    beam_size=1,
                    language="en",
                    vad_filter=True,
                    vad_parameters=dict(min_silence_duration_ms=250),
                    condition_on_previous_text=False,
                    temperature=0.0
                )
                text = " ".join([seg.text for seg in segments]).strip()
                return text, info.language
            except Exception as e:
                logger.warning(f"Whisper transcription error: {e}")
                return "", "en"

        text, detected_lang = await asyncio.to_thread(_transcribe)
        if text:
            logger.info(f"🎤 [VOICE TRANSCRIPTION] Transcribed: \"{text}\"")
        return SpeechEvent(
            type=SpeechEventType.FINAL_TRANSCRIPT,
            alternatives=[SpeechData(text=text, language=detected_lang or "en")]
        )

def prewarm(proc: JobProcess):
    """
    Pre-load heavy neural models (VAD, Whisper, Kokoro) so room sessions start with zero latency.
    """
    logger.info("Pre-warming AI models in background worker process...")
    try:
        proc.userdata["vad"] = silero.VAD.load()
    except Exception as e:
        logger.warning(f"VAD prewarm notice: {e}")

    try:
        model_name = os.getenv("WHISPER_MODEL", "base.en")
        proc.userdata["stt"] = FasterWhisperSTT(model_size=model_name)
    except Exception as e:
        logger.warning(f"Whisper STT prewarm notice: {e}")

    try:
        from jarvis_tts import KokoroTTS
        tts = KokoroTTS(voice='af_heart', speed=1.05)
        tts._ensure_pipeline()
        proc.userdata["tts"] = tts
    except Exception as e:
        logger.warning(f"Kokoro TTS prewarm notice: {e}")

    logger.info("Pre-warming completed.")



async def entrypoint(ctx: JobContext):
    """
    Main entrypoint for each Rocky LiveKit voice session.
    """
    logger.info(f"Agent connecting to room: {ctx.room.name}")
    await ctx.connect()
    logger.info(f"Agent successfully connected to room: {ctx.room.name}")

    # Silero VAD (pre-warmed or on-demand)
    vad = ctx.proc.userdata.get("vad")
    if vad is None:
        try:
            vad = silero.VAD.load()
        except Exception as e:
            logger.error(f"Failed to load Silero VAD: {e}")
            return

    # Ollama LLM
    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
    model_name = os.getenv("OLLAMA_MODEL", "qwen3.5b")
    logger.info(f"Connecting to Ollama LLM endpoint: {ollama_url}/v1 (model: {model_name})")
    llm_instance = openai.LLM.with_ollama(
        model=model_name,
        base_url=f"{ollama_url}/v1",
    )

    # Local Whisper STT
    whisper_stt = ctx.proc.userdata.get("stt")
    if whisper_stt is None:
        whisper_stt = FasterWhisperSTT(model_size=os.getenv("WHISPER_MODEL", "base.en"))
    stt_stream = stt.StreamAdapter(stt=whisper_stt, vad=vad)

    # TTS Engine: Ultra-low latency streaming ElevenLabs or Sentence-Chunked Streaming KokoroTTS
    tts_engine = ctx.proc.userdata.get("tts")
    if tts_engine is None:
        eleven_key = os.getenv("ELEVENLABS_API_KEY")
        if eleven_key:
            from jarvis_tts import ElevenLabsTTS
            tts_engine = ElevenLabsTTS(api_key=eleven_key)
            logger.info("Using ultra-low-latency streaming ElevenLabs TTS engine.")
        else:
            try:
                from jarvis_tts import KokoroTTS
                tts_engine = KokoroTTS(voice='af_heart', speed=1.05)
                tts_engine._ensure_pipeline()
                logger.info("Using sentence-chunked streaming Kokoro TTS engine.")
            except Exception as e:
                logger.warning(f"Falling back to PiperTTS: {e}")
                from jarvis_tts import PiperTTS
                piper_model = os.getenv("PIPER_MODEL_PATH", "/opt/models/en_US-lessac-medium.onnx")
                tts_engine = PiperTTS(model_path=piper_model)

    # Ultra-Low Latency Voice Loop Turn Detection:
    # min_delay=0.35s silence closes turn immediately for <600ms latency
    turn_handling = TurnHandlingOptions(
        turn_detection="vad",
        endpointing=EndpointingOptions(
            mode="fixed",
            min_delay=0.35,
            max_delay=0.55,
        ),
        interruption=InterruptionOptions(
            mode="vad",
        ),
    )


    def _get_active_username() -> str:
        if ctx.room.remote_participants:
            for p in ctx.room.remote_participants.values():
                if p.identity and not p.identity.startswith("agent-"):
                    return p.identity
        return "admin"

    backend_api_url = os.getenv("INTERNAL_API_URL", "http://api:8333")

    @function_tool(description="Add one or more items to the user's shopping list and open the shopping panel on screen")
    async def add_to_shopping_list(item_names: str, category: str = "General") -> str:
        username = _get_active_username()
        raw_items = [re.sub(r'^(?:and|a|an|some|the)\s+', '', it.strip(), flags=re.IGNORECASE)
                     for it in re.split(r',|\band\b|&', item_names) if it.strip()]
        if not raw_items:
            raw_items = [item_names.strip()]

        added = []
        async with aiohttp.ClientSession() as http_sess:
            for it in raw_items:
                clean_name = it.capitalize()
                cat = category
                lower_name = clean_name.lower()
                if any(w in lower_name for w in ("charger", "phone", "iphone", "cable", "laptop", "macbook", "airpods", "headphone", "battery", "adapter", "usb", "screen", "keyboard", "mouse")):
                    cat = "Electronics"
                elif any(w in lower_name for w in ("milk", "bread", "eggs", "apple", "banana", "fruit", "cheese", "coffee", "tea", "pizza", "groceries")):
                    cat = "Grocery"

                try:
                    async with http_sess.post(
                        f"{backend_api_url}/api/assistant/action",
                        json={
                            "username": username,
                            "action": "add_shopping_item",
                            "data": {"name": clean_name, "quantity": 1, "category": cat}
                        },
                        timeout=aiohttp.ClientTimeout(total=2.0)
                    ) as resp:
                        if resp.status == 200:
                            added.append(clean_name)
                except Exception as e:
                    logger.warning(f"Error adding shopping item {clean_name}: {e}")

        try:
            payload = json.dumps({
                "type": "ui_action",
                "action": "open_panel",
                "panel": "shopping",
                "items": added
            }).encode("utf-8")
            await ctx.room.local_participant.publish_data(payload, reliable=True, topic="ui_action")
        except Exception as e:
            logger.warning(f"Failed to publish ui_action: {e}")

        names_str = ", ".join(added) if added else item_names
        return f"I have added {names_str} to your shopping list, sir. Opening the shopping panel."

    @function_tool(description="Open and display the user's shopping list panel on screen, showing current items")
    async def show_shopping_list() -> str:
        username = _get_active_username()
        item_summary = ""
        try:
            async with aiohttp.ClientSession() as http_sess:
                async with http_sess.post(
                    f"{backend_api_url}/api/assistant/action",
                    json={"username": username, "action": "get_shopping_items"},
                    timeout=aiohttp.ClientTimeout(total=2.0)
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        items = data.get("items", [])
                        if items:
                            names = [it.get("item_name") for it in items if it.get("item_name")]
                            item_summary = f" You currently have {len(names)} items: {', '.join(names[:3])}."
                        else:
                            item_summary = " Your shopping list is currently empty."
        except Exception as e:
            logger.warning(f"Failed to query shopping items: {e}")

        try:
            payload = json.dumps({
                "type": "ui_action",
                "action": "open_panel",
                "panel": "shopping"
            }).encode("utf-8")
            await ctx.room.local_participant.publish_data(payload, reliable=True, topic="ui_action")
        except Exception as e:
            logger.warning(f"Failed to publish ui_action: {e}")

        return f"Opening your shopping list now, sir.{item_summary}"

    # Initialize agent session
    session = AgentSession(
        stt=stt_stream,
        llm=llm_instance,
        tts=tts.StreamAdapter(tts=tts_engine) if not isinstance(tts_engine, tts.StreamAdapter) else tts_engine,
        vad=vad,
        turn_handling=turn_handling,
        tools=[add_to_shopping_list, show_shopping_list],
    )

    # Voice Operation Mode & Hotword Guard State:
    # Default is PTT (Push-to-Talk) mode as requested
    voice_mode = "ptt"           # "ptt" | "continuous"
    hotword_guard = True         # In continuous mode: True = require "Rocky"; False = natural 2-way conversation

    STOP_PATTERNS = (
        "stop", "rocky stop", "hey rocky stop", "shut up", "rocky shut up",
        "cancel", "halt", "quiet", "be quiet", "stop talking", "please stop",
        "silence", "pause"
    )
    HOTWORD_NAMES = ("hey rocky", "rocky", "hey jarvis", "jarvis")

    # Attach event listeners for real-time request/response conversation logging & transcript broadcasting
    @session.on("user_input_transcribed")
    def on_user_transcription(ev):
        if ev.is_final and ev.transcript.strip():
            user_text = ev.transcript.strip()
            user_lower = user_text.lower().strip()
            clean_user_lower = re.sub(r"[^\w\s]", "", user_lower).strip()

            # 1. Stop Command Detection (Voice interruption)
            if clean_user_lower in STOP_PATTERNS or any(clean_user_lower.startswith(sp) for sp in STOP_PATTERNS):
                logger.info(f"🛑 [VOICE STOP COMMAND DETECTED] User said '{user_text}'. Halting Rocky immediately.")
                session.clear_user_turn()
                asyncio.create_task(session.interrupt(force=True))
                asyncio.create_task(_broadcast_voice_control(ctx, "interrupted", {"state": "listening", "reason": "voice_stop"}))
                asyncio.create_task(_broadcast_and_save_transcript(ctx, "user", user_text))
                return

            # 2. Hotword Guard in Continuous Mode (Filter ambient room sound / chatter)
            if voice_mode == "continuous" and hotword_guard:
                has_hotword = any(clean_user_lower.startswith(hw) or f" {hw}" in clean_user_lower for hw in HOTWORD_NAMES)
                if not has_hotword:
                    logger.info(f"🚫 [HOTWORD FILTERED] Dropped ambient/side speech: '{user_text}' (Hotword Guard is ON)")
                    session.clear_user_turn()
                    try:
                        asyncio.create_task(session.interrupt(force=True))
                    except Exception:
                        pass
                    asyncio.create_task(_broadcast_voice_control(ctx, "ambient_filtered", {"text": user_text}))
                    return
                else:
                    logger.info(f"⚡ [HOTWORD DETECTED] Utterance contains hotword: '{user_text}'")

            # 3. If user said only the hotword, acknowledge promptly
            if clean_user_lower in HOTWORD_NAMES:
                session.clear_user_turn()
                async def _say_hotword_ack():
                    await session.interrupt(force=True)
                    ack_msg = "Yes, sir? How can I assist you?"
                    logger.info(f"🗣️ [HOTWORD ACKNOWLEDGEMENT] Rocky: {ack_msg}")
                    await session.say(ack_msg, allow_interruptions=True)
                    await _broadcast_and_save_transcript(ctx, "assistant", ack_msg)
                asyncio.create_task(_say_hotword_ack())
                asyncio.create_task(_broadcast_and_save_transcript(ctx, "user", user_text))
                return

            # 4. Clean leading hotword if present for cleaner LLM / action processing
            processed_text = user_text
            for hw in HOTWORD_NAMES:
                pattern = re.compile(rf"^(?:please\s+)?{hw}[\s,:]*", re.IGNORECASE)
                if pattern.search(processed_text):
                    processed_text = pattern.sub("", processed_text).strip()
                    break
            if not processed_text:
                processed_text = user_text

            logger.info(f"🎤 [VOICE REQUEST RECEIVED] User: \"{processed_text}\" (Raw: \"{user_text}\")")
            asyncio.create_task(_broadcast_and_save_transcript(ctx, "user", user_text))

            async def _check_and_run_voice_action():
                action_spoken = await _execute_voice_action(ctx, session, processed_text)
                if action_spoken:
                    session.clear_user_turn()
                    await session.interrupt(force=True)
                    logger.info(f"🗣️ [SPEAKING VOICE ACTION CONFIRMATION] {action_spoken}")
                    await session.say(action_spoken, allow_interruptions=True)
                    await _broadcast_and_save_transcript(ctx, "assistant", action_spoken)

            asyncio.create_task(_check_and_run_voice_action())

    @session.on("conversation_item_added")
    def on_conversation_item(ev):
        item = ev.item
        role = getattr(item, "role", "")
        text = getattr(item, "text_content", "") or getattr(item, "content", "")
        if role == "assistant" and text:
            assistant_text = text.strip()
            logger.info(f"🤖 [AI RESPONSE GENERATED] Rocky: \"{assistant_text}\"")
            asyncio.create_task(_broadcast_and_save_transcript(ctx, "assistant", assistant_text))

    current_agent_state = "idle"

    @session.on("agent_state_changed")
    def on_state_changed(ev):
        nonlocal current_agent_state
        current_agent_state = ev.new_state
        logger.info(f"🔄 [AGENT STATE] {ev.old_state} -> {ev.new_state}")
        asyncio.create_task(_broadcast_voice_control(ctx, "agent_state", {"state": ev.new_state}))

    @session.on("user_state_changed")
    def on_user_state_changed(ev):
        nonlocal current_agent_state
        # Full-Duplex Interruption: If user starts speaking while Rocky is speaking, broadcast barge-in event
        agent_speaking = current_agent_state == "speaking" or getattr(session, "agent_state", "") == "speaking"
        if ev.new_state == "speaking" and agent_speaking:
            logger.info("⚡ [BARGE-IN DETECTED] User spoke over Rocky; interrupting playback immediately.")
            asyncio.create_task(_broadcast_voice_control(ctx, "barge_in", {"reason": "interrupted"}))

    # Initialize wake-word detector instance
    wake_engine = WakeWordEngine()


    # Start agent in the room with persistent continuous session settings
    await session.start(
        room=ctx.room,
        agent=Agent(
            instructions="""You are Rocky, a sophisticated AI assistant. Be concise, witty, and helpful. Address the user formally but warmly. Never use markdown formatting in responses."""
        ),
        room_options=room_io.RoomOptions(
            close_on_disconnect=True,
        ),
    )
    logger.info("Rocky agent session started and listening continuously for speech.")

    # Preload recent conversation memory from backend so Rocky maintains continuous context across HUD and Comms
    try:
        username = "admin"
        if ctx.room.remote_participants:
            first_p = next(iter(ctx.room.remote_participants.values()))
            username = first_p.identity or first_p.name or "admin"
        
        backend_url = os.getenv("INTERNAL_API_URL", "http://api:8333")
        async with aiohttp.ClientSession() as http_sess:
            async with http_sess.get(
                f"{backend_url}/api/voice/history",
                params={"username": username, "limit": 10},
                timeout=aiohttp.ClientTimeout(total=3.0)
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    past_turns = data.get("messages", [])
                    for t in past_turns:
                        role = t.get("role")
                        content = t.get("content")
                        if role in ("user", "assistant") and content:
                            session.history.add_message(role=role, content=content)
                    logger.info(f"Loaded {len(past_turns)} past conversation turns into Rocky memory.")
    except Exception as e:
        logger.warning(f"Could not preload history into Rocky voice session: {e}")

    def parse_reminder_request(text: str):
        clean = text.strip()
        pattern = r"^(?:please\s+)?(?:add\s+(?:a\s+)?reminder\s+(?:to|for)?|set\s+(?:a\s+)?reminder\s+(?:to|for)?|create\s+(?:a\s+)?reminder\s+(?:to|for)?|remind\s+me\s+(?:to|about)?)\s+(.+)$"
        m = re.search(pattern, clean, re.IGNORECASE)
        if not m:
            m = re.search(r"^(?:a\s+)?reminder\s+(?:to|for)\s+(.+)$", clean, re.IGNORECASE)
            if not m:
                return None

        raw_body = m.group(1).strip()
        now = datetime.now()
        target_date = now.date()
        target_hour = 9
        target_minute = 0

        if re.search(r"\bday\s+after\s+tomorrow\b", raw_body, re.IGNORECASE):
            target_date = now.date() + timedelta(days=2)
            raw_body = re.sub(r"\bday\s+after\s+tomorrow\b", "", raw_body, flags=re.IGNORECASE)
        elif re.search(r"\btomorrow\b", raw_body, re.IGNORECASE):
            target_date = now.date() + timedelta(days=1)
            raw_body = re.sub(r"\btomorrow\b", "", raw_body, flags=re.IGNORECASE)
        elif re.search(r"\btoday\b", raw_body, re.IGNORECASE):
            target_date = now.date()
            raw_body = re.sub(r"\btoday\b", "", raw_body, flags=re.IGNORECASE)
        elif re.search(r"\btonight\b", raw_body, re.IGNORECASE):
            target_date = now.date()
            target_hour = 20
            raw_body = re.sub(r"\btonight\b", "", raw_body, flags=re.IGNORECASE)

        rel_m = re.search(r"\bin\s+(\d+)\s*(hour|hr|minute|min)s?\b", raw_body, re.IGNORECASE)
        if rel_m:
            val = int(rel_m.group(1))
            unit = rel_m.group(2).lower()
            target_dt = now + timedelta(hours=val) if ("hour" in unit or "hr" in unit) else now + timedelta(minutes=val)
            raw_body = re.sub(r"\bin\s+(\d+)\s*(?:hour|hr|minute|min)s?\b", "", raw_body, flags=re.IGNORECASE)
            target_date = target_dt.date()
            target_hour = target_dt.hour
            target_minute = target_dt.minute
        else:
            time_m = re.search(r"(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b", raw_body, re.IGNORECASE)
            if time_m:
                hr_val = int(time_m.group(1))
                min_val = int(time_m.group(2)) if time_m.group(2) else 0
                meridiem = time_m.group(3).lower() if time_m.group(3) else None
                matched_text = time_m.group(0).strip()
                if meridiem or "at" in matched_text.lower() or hr_val > 12:
                    if meridiem == "pm" and hr_val < 12:
                        hr_val += 12
                    elif meridiem == "am" and hr_val == 12:
                        hr_val = 0
                    target_hour = hr_val
                    target_minute = min_val
                    raw_body = re.sub(re.escape(matched_text), "", raw_body)

        clean_title = re.sub(r"\s+", " ", raw_body).strip()
        clean_title = re.sub(r"^(?:at|on|for)\s+", "", clean_title, flags=re.IGNORECASE)
        clean_title = re.sub(r"\s+(?:at|on|for)$", "", clean_title, flags=re.IGNORECASE).strip()
        if not clean_title:
            clean_title = "Reminder"

        final_dt = datetime(target_date.year, target_date.month, target_date.day, target_hour, target_minute, 0)
        formatted_title = clean_title[0].upper() + clean_title[1:] if len(clean_title) > 1 else clean_title.upper()
        return {
            "title": formatted_title,
            "scheduled_at": final_dt.isoformat(),
            "display_time": final_dt.strftime("%b %d at %I:%M %p")
        }

    async def _execute_voice_action(ctx: JobContext, session: AgentSession, user_text: str) -> Optional[str]:
        """
        Check if the user request corresponds to a panel-integrated action:
          - Shopping list: add item(s) or view shopping list
          - Calendar & Reminders: schedule event, set reminder, view calendar
          - Task manager: add task, view tasks
          - Smart home: open smart home panel
        If matched:
          1. Calls backend /api/assistant/action to persist the change.
          2. Emits real-time data channel packet with topic='ui_action' to open/refresh the panel.
          3. Returns the spoken confirmation string for Kokoro TTS.
        If no match, returns None to proceed with general Ollama LLM generation.
        """
        clean = user_text.strip().lower()
        backend_url = os.getenv("INTERNAL_API_URL", "http://api:8333")
        
        username = "admin"
        if ctx.room.remote_participants:
            for p in ctx.room.remote_participants.values():
                if p.identity and not p.identity.startswith("agent-"):
                    username = p.identity
                    break

        # 0. Check for Pending HitL Safeguard Confirmation
        async with aiohttp.ClientSession() as http_sess:
            try:
                async with http_sess.get(
                    f"{backend_url}/api/assistant/hitl/pending",
                    params={"username": username},
                    timeout=aiohttp.ClientTimeout(total=2.0)
                ) as resp:
                    if resp.status == 200:
                        hitl_data = await resp.json()
                        pending_list = hitl_data.get("pending", [])
                        if pending_list:
                            latest_pending = pending_list[0]
                            action_id = latest_pending["action_id"]
                            # Check affirmative response
                            if any(w in clean.split() for w in ("yes", "confirm", "proceed", "authorize", "affirmative", "do")):
                                await http_sess.post(
                                    f"{backend_url}/api/assistant/hitl/confirm",
                                    json={"action_id": action_id, "username": username},
                                    timeout=aiohttp.ClientTimeout(total=4.0)
                                )
                                payload = json.dumps({
                                    "type": "ui_action",
                                    "action": "hitl_decision",
                                    "action_id": action_id,
                                    "decision": "confirmed"
                                }).encode("utf-8")
                                await ctx.room.local_participant.publish_data(payload, reliable=True, topic="ui_action")
                                return "Authorization confirmed. Destructive operation executed successfully, sir."

                            # Check negative response
                            elif any(w in clean.split() for w in ("no", "cancel", "abort", "stop", "negative")):
                                await http_sess.post(
                                    f"{backend_url}/api/assistant/hitl/reject",
                                    json={"action_id": action_id, "username": username},
                                    timeout=aiohttp.ClientTimeout(total=3.0)
                                )
                                payload = json.dumps({
                                    "type": "ui_action",
                                    "action": "hitl_decision",
                                    "action_id": action_id,
                                    "decision": "rejected"
                                }).encode("utf-8")
                                await ctx.room.local_participant.publish_data(payload, reliable=True, topic="ui_action")
                                return "Operation aborted, sir. No changes were made."
            except Exception as e:
                logger.warning(f"Error checking pending HitL actions: {e}")

        # 0.1 Check for Destructive Commands Requiring HitL Staging
        file_del = re.search(r"(?:delete|remove|erase|wipe)\s+(?:file|files|logs|directory|folder|history|database)\s*(.*)", clean, re.IGNORECASE)
        if not file_del:
            file_del = re.search(r"\b(?:rm\s+-rf|rm\s+-f|rmdir|unlink)\s+(.+)", clean, re.IGNORECASE)
        term_match = re.search(r"^(?:run|execute|exec)\s+(?:command|terminal|bash|shell|script)\s*[:\s]+(.+)", clean, re.IGNORECASE)
        if not term_match and (clean.startswith("npm ") or clean.startswith("pip ") or clean.startswith("git ") or clean.startswith("docker ") or clean.startswith("sudo ")):
            term_match = re.search(r"^(.+)", clean)
        email_match = re.search(r"(?:send|compose|dispatch)\s+(?:an?\s+)?email\s+(?:to\s+)?([^\s,]+@[^\s,]+)(?:\s+(?:about|with|subject|saying)\s+(.+))?", clean, re.IGNORECASE)

        if file_del or term_match or email_match:
            if file_del:
                cat = "file_deletion"
                target = file_del.group(1).strip() or "specified file/database resource"
                title = f"File Deletion: {target}"
                spoken_prompt = f"Sir, executing that command will permanently delete {target}. Please confirm: do you authorize this deletion?"
                details = {"file_path": target}
            elif term_match:
                cat = "terminal_write"
                target = term_match.group(1).strip()
                title = f"Terminal Shell Execution: `{target}`"
                spoken_prompt = f"Sir, that operation will execute a terminal command on the host: {target}. Do you authorize this execution?"
                details = {"raw_command": target}
            else:
                cat = "email_sending"
                target = email_match.group(1).strip()
                title = f"Dispatch Email to: {target}"
                spoken_prompt = f"Sir, that will transmit an email to {target}. Do you confirm dispatching this email?"
                details = {"recipient": target}

            async with aiohttp.ClientSession() as http_sess:
                try:
                    async with http_sess.post(
                        f"{backend_url}/api/assistant/hitl/stage",
                        json={
                            "username": username,
                            "category": cat,
                            "title": title,
                            "command": user_text,
                            "target": target,
                            "details": details,
                            "ttl_seconds": 60
                        },
                        timeout=aiohttp.ClientTimeout(total=2.0)
                    ) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            staged = data.get("action", {})
                            payload = json.dumps({
                                "type": "ui_action",
                                "action": "hitl_required",
                                "hitl": staged
                            }).encode("utf-8")
                            await ctx.room.local_participant.publish_data(payload, reliable=True, topic="ui_action")
                except Exception as e:
                    logger.warning(f"Error staging HitL action: {e}")

            return spoken_prompt

        # 1. Shopping List: Open / View
        if re.search(r"(?:open|show|display|view|check|bring\s+up|what(?:\'s|\s+is)\s+on)\s+(?:my\s+|the\s+)?shopping\s*(?:list|cart)?", clean, re.IGNORECASE) or re.search(r"^(?:show|open|view)\s+(?:my\s+|the\s+)?shopping$", clean, re.IGNORECASE):
            item_summary = ""
            try:
                async with aiohttp.ClientSession() as http_sess:
                    async with http_sess.post(
                        f"{backend_url}/api/assistant/action",
                        json={"username": username, "action": "get_shopping_items"},
                        timeout=aiohttp.ClientTimeout(total=2.0)
                    ) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            items = data.get("items", [])
                            if items:
                                names = [it.get("item_name") for it in items if it.get("item_name")]
                                item_summary = f" You currently have {len(names)} item{'s' if len(names) != 1 else ''}: {', '.join(names[:3])}."
                            else:
                                item_summary = " Your shopping list is currently empty."
            except Exception as e:
                logger.warning(f"Failed to fetch shopping items for speech: {e}")

            try:
                payload = json.dumps({
                    "type": "ui_action",
                    "action": "open_panel",
                    "panel": "shopping"
                }).encode("utf-8")
                await ctx.room.local_participant.publish_data(payload, reliable=True, topic="ui_action")
            except Exception as e:
                logger.warning(f"Failed to publish ui_action: {e}")
            return f"Opening your shopping list now, sir.{item_summary}"

        # 2. Shopping List: Add Items
        shop_add = re.search(r"(?:add|put|place|include|insert)\s+(.+?)\s+(?:to|on|in|into)\s+(?:my\s+|the\s+)?(?:shopping\s*list|groceries|grocery\s*list|shopping|cart|list)", clean, re.IGNORECASE)
        if not shop_add:
            shop_add = re.search(r"^(?:please\s+)?(?:(?:i\s+|we\s+)?(?:need\s+to\s+buy|want\s+to\s+buy|need|want)|buy|order|purchase|get\s+me)\s+(?:an?\s+|some\s+)?(.+?)(?:\s+(?:for|on|in|to)\s+(?:my\s+|the\s+)?(?:shopping\s*list|cart|list))?[\.\?!]?$", clean, re.IGNORECASE)
        if not shop_add and not any(w in clean for w in ("meeting", "event", "call", "calendar", "task", "todo", "reminder", "alarm", "note", "timer", "file")):
            shop_add = re.search(r"^(?:please\s+)?(?:add|put)\s+(?:an?\s+|some\s+)?(.+?)[\.\?!]?$", clean, re.IGNORECASE)

        if shop_add:
            raw = shop_add.group(1).strip()
            raw = re.sub(r"[\.\?!]+$", "", raw)
            raw = re.sub(r"\s+(?:please|for\s+me|as\s+well|also)$", "", raw, flags=re.IGNORECASE)
            items = [re.sub(r"^(?:and|a|an|some|the)\s+", "", it.strip(), flags=re.IGNORECASE)
                     for it in re.split(r",|\band\b|&", raw) if it.strip()]
            if items:
                added_names = []
                async with aiohttp.ClientSession() as http_sess:
                    for item_name in items:
                        clean_name = item_name.capitalize()
                        cat = "General"
                        lower_name = clean_name.lower()
                        if any(w in lower_name for w in ("charger", "phone", "iphone", "cable", "laptop", "macbook", "airpods", "headphone", "battery", "adapter", "usb", "screen", "keyboard", "mouse", "monitor")):
                            cat = "Electronics"
                        elif any(w in lower_name for w in ("milk", "bread", "eggs", "apple", "banana", "fruit", "vegetable", "cheese", "butter", "coffee", "tea", "sugar", "salt", "snack", "cereal", "water", "rice", "flour", "pasta", "tomato", "potato", "onion", "garlic", "pizza", "grocery", "groceries")):
                            cat = "Grocery"

                        try:
                            async with http_sess.post(
                                f"{backend_url}/api/assistant/action",
                                json={
                                    "username": username,
                                    "action": "add_shopping_item",
                                    "data": {"name": clean_name, "quantity": 1, "category": cat}
                                },
                                timeout=aiohttp.ClientTimeout(total=2.0)
                            ) as resp:
                                if resp.status == 200:
                                    added_names.append(clean_name)
                        except Exception as e:
                            logger.warning(f"Error adding shopping item {clean_name}: {e}")

                try:
                    payload = json.dumps({
                        "type": "ui_action",
                        "action": "open_panel",
                        "panel": "shopping",
                        "items": added_names
                    }).encode("utf-8")
                    await ctx.room.local_participant.publish_data(payload, reliable=True, topic="ui_action")
                except Exception as e:
                    logger.warning(f"Failed to publish ui_action for shopping: {e}")

                item_str = ", ".join(added_names) if added_names else raw
                return f"I have added {item_str} to your shopping list, sir. Opening the shopping panel."

        # 3. Calendar & Meetings: Schedule Event
        cal_match = re.search(r"(?:schedule|book)\s+(?:a\s+)?(?:meeting|event|call)\s+(?:called\s+|titled\s+|for\s+)?(.+)", clean, re.IGNORECASE)
        if not cal_match:
            cal_match = re.search(r"add\s+(.+?)\s+to\s+(?:my\s+|the\s+)?calendar", clean, re.IGNORECASE)

        if cal_match:
            event_raw = cal_match.group(1).strip()
            title = event_raw.capitalize()
            start_time = (datetime.now() + timedelta(days=1)).replace(hour=10, minute=0, second=0).isoformat()
            if "tomorrow" in clean:
                start_time = (datetime.now() + timedelta(days=1)).replace(hour=14, minute=0, second=0).isoformat()
            elif "today" in clean:
                start_time = (datetime.now() + timedelta(hours=2)).replace(minute=0, second=0).isoformat()

            async with aiohttp.ClientSession() as http_sess:
                try:
                    async with http_sess.post(
                        f"{backend_url}/api/assistant/action",
                        json={
                            "username": username,
                            "action": "create_calendar_event",
                            "data": {"title": title, "start_time": start_time, "description": "Scheduled via voice"}
                        },
                        timeout=aiohttp.ClientTimeout(total=2.0)
                    ) as resp:
                        pass
                except Exception as e:
                    logger.warning(f"Error creating calendar event {title}: {e}")

            try:
                payload = json.dumps({
                    "type": "ui_action",
                    "action": "open_panel",
                    "panel": "calendar"
                }).encode("utf-8")
                await ctx.room.local_participant.publish_data(payload, reliable=True, topic="ui_action")
            except Exception as e:
                logger.warning(f"Failed to publish ui_action for calendar: {e}")

            return f"I have scheduled '{title}' in your calendar, sir. The calendar panel is open."

        # 4. Reminders: Set / Add Reminder
        rem_info = parse_reminder_request(user_text)
        if rem_info:
            rem_title = rem_info["title"]
            scheduled_at = rem_info["scheduled_at"]
            disp_time = rem_info["display_time"]

            async with aiohttp.ClientSession() as http_sess:
                try:
                    async with http_sess.post(
                        f"{backend_url}/api/assistant/action",
                        json={
                            "username": username,
                            "action": "create_reminder",
                            "data": {
                                "title": rem_title,
                                "scheduled_at": scheduled_at,
                                "description": f"Scheduled for {disp_time}"
                            }
                        },
                        timeout=aiohttp.ClientTimeout(total=2.0)
                    ) as resp:
                        pass
                except Exception as e:
                    logger.warning(f"Error creating reminder {rem_title}: {e}")

            try:
                payload = json.dumps({
                    "type": "ui_action",
                    "action": "open_panel",
                    "panel": "calendar"
                }).encode("utf-8")
                await ctx.room.local_participant.publish_data(payload, reliable=True, topic="ui_action")
            except Exception as e:
                logger.warning(f"Failed to publish ui_action: {e}")

            return f"I have set a reminder to '{rem_title}' for {disp_time}, sir. Opening your Calendar and Reminders panel."

        # 5. Calendar: Open / View
        if re.search(r"(?:open|show|display|view)\s+(?:my\s+|the\s+)?calendar", clean, re.IGNORECASE) or "what's on my schedule" in clean or "what is on my calendar" in clean:
            try:
                payload = json.dumps({
                    "type": "ui_action",
                    "action": "open_panel",
                    "panel": "calendar"
                }).encode("utf-8")
                await ctx.room.local_participant.publish_data(payload, reliable=True, topic="ui_action")
            except Exception as e:
                logger.warning(f"Failed to publish ui_action: {e}")
            return "Opening your calendar and schedule panel, sir."

        # 6. Tasks: Add Task
        task_match = re.search(r"(?:add|create)\s+(?:a\s+)?task\s+(?:to\s+|for\s+)?(.+)", clean, re.IGNORECASE)
        if task_match:
            task_title = task_match.group(1).strip().capitalize()
            async with aiohttp.ClientSession() as http_sess:
                try:
                    async with http_sess.post(
                        f"{backend_url}/api/assistant/action",
                        json={
                            "username": username,
                            "action": "create_task",
                            "data": {"title": task_title, "priority": "P2"}
                        },
                        timeout=aiohttp.ClientTimeout(total=2.0)
                    ) as resp:
                        pass
                except Exception as e:
                    logger.warning(f"Error creating task: {e}")

            try:
                payload = json.dumps({
                    "type": "ui_action",
                    "action": "open_panel",
                    "panel": "tasks"
                }).encode("utf-8")
                await ctx.room.local_participant.publish_data(payload, reliable=True, topic="ui_action")
            except Exception as e:
                logger.warning(f"Failed to publish ui_action: {e}")

            return f"I have added '{task_title}' to your task manager, sir. Opening the tasks panel."

        # 7. Tasks: Open / View
        if re.search(r"(?:open|show|display|view)\s+(?:my\s+|the\s+)?(?:tasks|task manager|todo list)", clean, re.IGNORECASE):
            try:
                payload = json.dumps({
                    "type": "ui_action",
                    "action": "open_panel",
                    "panel": "tasks"
                }).encode("utf-8")
                await ctx.room.local_participant.publish_data(payload, reliable=True, topic="ui_action")
            except Exception as e:
                logger.warning(f"Failed to publish ui_action: {e}")
            return "Opening your task manager, sir."

        return None

    # Handler for Comms chat text messages while voice conversation is online:
    # Rocky speaks aloud the reply (online continuous) and broadcasts the text transcript.
    async def _handle_comms_chat(user_text: str):
        try:
            # 1. Broadcast user turn and persist to database
            await _broadcast_and_save_transcript(ctx, "user", user_text)
            
            # 2. Check for panel-integrated action (Shopping, Calendar, Reminders, Tasks)
            action_spoken = await _execute_voice_action(ctx, session, user_text)
            if action_spoken:
                logger.info(f"🗣️ [SPEAKING COMMS ACTION CONFIRMATION] {action_spoken}")
                await session.say(action_spoken, allow_interruptions=True)
                await _broadcast_and_save_transcript(ctx, "assistant", action_spoken)
            else:
                logger.info(f"🗣️ [SPEAKING COMMS REPLY] Generating spoken reply for: \"{user_text}\"")
                handle = session.generate_reply(user_input=user_text, allow_interruptions=True)
                await handle
                if handle.exception():
                    logger.error(f"SpeechHandle generation error: {handle.exception()}")
                else:
                    for item in getattr(handle, "chat_items", []):
                        if getattr(item, "role", "") == "assistant":
                            txt = getattr(item, "text_content", "") or getattr(item, "raw_text_content", "")
                            if txt:
                                await _broadcast_and_save_transcript(ctx, "assistant", txt)
        except Exception as e:
            logger.error(f"Failed to generate spoken reply for comms chat: {e}", exc_info=True)

    @ctx.room.on("data_received")
    def on_data_received(dp: rtc.DataPacket):
        topic = getattr(dp, "topic", "")
        if topic == "comms_chat":
            try:
                raw_bytes = dp.data
                data = json.loads(raw_bytes.decode("utf-8"))
                user_text = data.get("text", "").strip()
                if user_text:
                    logger.info(f"💬 [COMMS CHAT RECEIVED] User: \"{user_text}\"")
                    asyncio.create_task(_handle_comms_chat(user_text))
            except Exception as e:
                logger.error(f"Error processing comms_chat data packet: {e}", exc_info=True)
        elif topic == "voice_config":
            try:
                raw_bytes = dp.data
                cfg = json.loads(raw_bytes.decode("utf-8"))
                nonlocal voice_mode, hotword_guard
                if "mode" in cfg:
                    voice_mode = cfg["mode"]
                    logger.info(f"⚙️ [VOICE MODE UPDATED VIA DATA CHANNEL] Mode set to: '{voice_mode}'")
                if "hotword_guard" in cfg:
                    hotword_guard = bool(cfg["hotword_guard"])
                    logger.info(f"🛡️ [HOTWORD GUARD UPDATED VIA DATA CHANNEL] Hotword Guard set to: {hotword_guard}")
            except Exception as e:
                logger.warning(f"Error parsing voice_config data packet: {e}")
        elif topic == "voice_control":
            try:
                raw_bytes = dp.data
                ctrl = json.loads(raw_bytes.decode("utf-8"))
                ctrl_type = ctrl.get("type", "")
                if ctrl_type in ("stop", "interrupt", "barge_in"):
                    logger.info(f"🛑 [STOP COMMAND RECEIVED FROM UI] Halting Rocky speech immediately.")
                    session.clear_user_turn()
                    asyncio.create_task(session.interrupt(force=True))
                    asyncio.create_task(_broadcast_voice_control(ctx, "interrupted", {"state": "listening", "reason": "ui_stop"}))
            except Exception as e:
                logger.warning(f"Error parsing voice_control packet: {e}")

    @ctx.room.on("participant_disconnected")
    def on_participant_disconnected(p: rtc.RemoteParticipant):
        logger.info(f"Participant disconnected from room {ctx.room.name}: {p.identity}")
        async def _check_and_shutdown():
            await asyncio.sleep(5)
            if not ctx.room.remote_participants:
                logger.info(f"Room {ctx.room.name} has no remaining participants. Shutting down session cleanly.")
                ctx.shutdown()
        asyncio.create_task(_check_and_shutdown())

    # Spoken greeting without 'All systems are nominal'
    try:
        from datetime import datetime
        hour = datetime.now().hour
        if 5 <= hour < 12:
            time_greeting = "Good morning"
        elif 12 <= hour < 17:
            time_greeting = "Good afternoon"
        elif 17 <= hour < 22:
            time_greeting = "Good evening"
        else:
            time_greeting = "Greetings"

        participant_name = ""
        if ctx.room.remote_participants:
            first_p = next(iter(ctx.room.remote_participants.values()))
            participant_name = first_p.name or first_p.identity or ""

        name_str = f", {participant_name.capitalize()}" if participant_name else ""
        greeting = f"{time_greeting}{name_str}! I am Rocky. How can I assist you today?"
        logger.info(f"Sending spoken dynamic greeting: \"{greeting}\"")
        await session.say(greeting, allow_interruptions=True)
    except Exception as e:
        logger.warning(f"Could not send initial spoken greeting: {e}")

    # Keep entrypoint active to maintain continuous conversation mode across multiple turns
    shutdown_event = asyncio.Event()
    async def _on_shutdown(reason=""):
        shutdown_event.set()
    ctx.add_shutdown_callback(_on_shutdown)
    await shutdown_event.wait()

if __name__ == "__main__":
    try:
        from stt_service import run_stt_service_thread
        run_stt_service_thread(host="0.0.0.0", port=8334)
        logger.info("⚡ [STARTUP] Decoupled STT service thread initiated on port 8334.")
    except Exception as e:
        logger.warning(f"Could not launch STT background thread: {e}")

    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            initialize_process_timeout=60.0,
            num_idle_processes=0,
        )
    )


