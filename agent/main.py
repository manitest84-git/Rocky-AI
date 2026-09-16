import os
import logging
from dotenv import load_dotenv
from livekit.agents import AgentSession, Agent, JobContext, WorkerOptions, cli
from livekit.plugins import openai, silero

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("jarvis-agent")

async def entrypoint(ctx: JobContext):
    """
    Main entrypoint for the Jarvis LiveKit agent.
    """
    logger.info(f"Agent joining room: {ctx.room.name}")
    await ctx.connect()
    
    # Local Silero VAD (Voice Activity Detection)
    try:
        vad = silero.VAD.load()
    except Exception as e:
        logger.error(f"Failed to load Silero VAD: {e}")
        return
    
    # Local LLM via Ollama (OpenAI-compatible endpoint)
    llm = openai.LLM.with_ollama(
        model=os.getenv("OLLAMA_MODEL", "jarvis"),
        base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434") + "/v1",
    )
    
    # Local STT via faster-whisper through OpenAI-compatible endpoint
    # If running speaches server, use that; otherwise direct faster-whisper
    stt = openai.STT(
        base_url=os.getenv("STT_BASE_URL", "http://localhost:8000/v1"),
        api_key="local",
        model="Systran/faster-whisper-small",
    )
    
    # Local TTS — Piper (CPU-optimized, <50ms) or Kokoro (GPU) fallback
    piper_model = os.getenv("PIPER_MODEL_PATH", "/opt/models/en_US-lessac-medium.onnx")
    try:
        from jarvis_tts import PiperTTS
        tts_engine = PiperTTS(model_path=piper_model)
        logger.info(f"Using Piper TTS (CPU-optimized): {piper_model}")
    except Exception:
        from jarvis_tts import KokoroTTS
        tts_engine = KokoroTTS(voice='af_heart', speed=1.05)
        logger.info("Piper TTS unavailable, falling back to Kokoro TTS")
    
    # Initialize session
    session = AgentSession(
        stt=stt,
        llm=llm,
        tts=tts_engine,
        vad=vad,
    )
    
    # Start agent
    await session.start(
        room=ctx.room,
        agent=Agent(
            instructions="""You are Rocky, a sophisticated AI assistant. Be concise, witty, and helpful. Address the user formally but warmly. Never use markdown formatting in responses."""
        ),
    )
    logger.info("Rocky agent session started successfully.")
    try:
        await session.say("Hello! I am Rocky. How can I make your day better today?", allow_interruptions=True)
    except Exception as e:
        logger.warning(f"Could not send initial spoken greeting: {e}")

if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
        )
    )
