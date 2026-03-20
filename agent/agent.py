"""
GraceTalk LiveKit Voice Agent
Powered by xAI Grok (LLM) + Deepgram (STT + TTS) via LiveKit Agents

Run with:
    python agent.py start

Requires environment variables:
    LIVEKIT_URL         - wss://your-project.livekit.cloud
    LIVEKIT_API_KEY     - LiveKit project API key
    LIVEKIT_API_SECRET  - LiveKit project API secret
    XAI_API_KEY         - xAI API key (https://console.x.ai/)
    DEEPGRAM_API_KEY    - Deepgram API key (https://console.deepgram.com/)
"""

import asyncio
import json
import logging
import os

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    WorkerOptions,
    cli,
)
from livekit.plugins import deepgram, silero
from livekit.plugins import openai as lk_openai

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gracetalk-agent")

SYSTEM_PROMPT_TEMPLATE = """You are playing the role of {persona_name}.
Your description: {persona_description}.

Your goal is to have a natural conversation with a Christian who is witnessing to you.
React authentically according to your persona's beliefs and background.
Do not break character.
Keep your responses conversational, concise, and natural for a voice conversation (1–3 sentences).
If they make a compelling point, you can acknowledge it — but stay true to your skepticism or beliefs.
Do not use markdown, bullet points, or lists in your responses."""


class WitnessPersona(Agent):
    """A LiveKit Agent that embodies an AI persona for faith-sharing practice."""

    def __init__(self, persona_name: str, persona_description: str) -> None:
        super().__init__(
            instructions=SYSTEM_PROMPT_TEMPLATE.format(
                persona_name=persona_name,
                persona_description=persona_description,
            )
        )
        self._persona_name = persona_name
        logger.info("WitnessPersona created: %s", persona_name)


async def entrypoint(ctx: JobContext) -> None:
    """Entry point called by LiveKit when a participant joins the room."""
    await ctx.connect()

    # Parse persona metadata from the room (set when the token was created)
    metadata: dict = {}
    try:
        metadata = json.loads(ctx.room.metadata or "{}")
    except json.JSONDecodeError:
        logger.warning("Could not parse room metadata; using defaults.")

    persona_name = metadata.get("personaName", "Alex")
    persona_description = metadata.get(
        "personaDescription",
        "A skeptical but open-minded person willing to have a respectful conversation.",
    )

    logger.info(
        "Starting session | persona=%s | conversation=%s",
        persona_name,
        metadata.get("conversationId", "unknown"),
    )

    # Build the voice pipeline
    session = AgentSession(
        # Voice Activity Detection
        vad=silero.VAD.load(),
        # Speech-to-Text via Deepgram
        stt=deepgram.STT(
            model="nova-2",
            language="en-US",
        ),
        # LLM via xAI Grok (OpenAI-compatible API)
        llm=lk_openai.LLM(
            model=os.environ.get("XAI_MODEL", "grok-3"),
            base_url="https://api.x.ai/v1",
            api_key=os.environ["XAI_API_KEY"],
        ),
        # Text-to-Speech via Deepgram Aura
        tts=deepgram.TTS(
            model=os.environ.get("DEEPGRAM_TTS_MODEL", "aura-asteria-en"),
        ),
    )

    await session.start(
        room=ctx.room,
        agent=WitnessPersona(persona_name, persona_description),
    )

    logger.info("Agent session started for room: %s", ctx.room.name)


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            worker_type="room",
        )
    )
