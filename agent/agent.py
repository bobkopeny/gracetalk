"""
GraceTalk LiveKit Voice Agent
Powered by xAI Grok Realtime Voice API via LiveKit Agents

Requires environment variables:
    LIVEKIT_URL              - wss://your-project.livekit.cloud
    LIVEKIT_API_KEY          - LiveKit project API key
    LIVEKIT_API_SECRET       - LiveKit project API secret
    XAI_API_KEY              - xAI API key (https://console.x.ai/)
    GRACETALK_API_URL        - https://gracetalk-production.up.railway.app
    GRACETALK_AGENT_SECRET   - shared secret for agent→app API callbacks
"""

import json
import logging
import os
import urllib.request

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    WorkerOptions,
    cli,
)
from livekit.agents import llm as agent_llm
from livekit.plugins import xai

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


def save_message_to_app(conversation_id: int, role: str, content: str) -> None:
    """POST a voice transcript back to the GraceTalk app for persistent storage."""
    api_url = os.environ.get("GRACETALK_API_URL", "").rstrip("/")
    secret = os.environ.get("GRACETALK_AGENT_SECRET", "")
    if not api_url or not secret:
        return

    try:
        payload = json.dumps({"role": role, "content": content}).encode()
        req = urllib.request.Request(
            f"{api_url}/api/agent/conversations/{conversation_id}/messages",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "X-Agent-Secret": secret,
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5) as r:
            r.read()
    except Exception as exc:
        logger.warning("Failed to save message to app: %s", exc)


class WitnessPersona(Agent):
    """LiveKit Agent that embodies a persona and saves transcripts back to the app."""

    def __init__(
        self,
        persona_name: str,
        persona_description: str,
        conversation_id: int | None,
        chat_ctx: agent_llm.ChatContext | None = None,
    ) -> None:
        kwargs = dict(
            instructions=SYSTEM_PROMPT_TEMPLATE.format(
                persona_name=persona_name,
                persona_description=persona_description,
            )
        )
        if chat_ctx is not None:
            kwargs["chat_ctx"] = chat_ctx
        super().__init__(**kwargs)
        self._persona_name = persona_name
        self._conversation_id = conversation_id
        logger.info("WitnessPersona created: %s (conv=%s)", persona_name, conversation_id)

    async def on_user_turn_completed(
        self, turn_ctx: agent_llm.ChatContext, new_message: agent_llm.ChatMessage
    ) -> None:
        """Called after the user finishes speaking — save their transcript."""
        if self._conversation_id and new_message.text_content:
            save_message_to_app(self._conversation_id, "user", new_message.text_content)

    async def on_agent_turn_completed(
        self, turn_ctx: agent_llm.ChatContext, new_message: agent_llm.ChatMessage
    ) -> None:
        """Called after the agent finishes speaking — save its transcript."""
        if self._conversation_id and new_message.text_content:
            save_message_to_app(self._conversation_id, "assistant", new_message.text_content)


async def entrypoint(ctx: JobContext) -> None:
    """Entry point called by LiveKit when a participant joins a room."""
    await ctx.connect()

    # Parse metadata — try room metadata first (new server), then fall back
    # to any remote participant's metadata (old server sent it there)
    metadata: dict = {}
    try:
        raw = ctx.room.metadata or ""
        if raw:
            metadata = json.loads(raw)
    except json.JSONDecodeError:
        pass

    if not metadata:
        for participant in ctx.room.remote_participants.values():
            try:
                if participant.metadata:
                    metadata = json.loads(participant.metadata)
                    break
            except json.JSONDecodeError:
                pass

    if not metadata:
        logger.warning("No metadata found in room or participants; using defaults.")

    persona_name: str = metadata.get("personaName", "Alex")
    persona_description: str = metadata.get(
        "personaDescription",
        "A skeptical but open-minded person willing to have a respectful conversation.",
    )
    conversation_id: int | None = metadata.get("conversationId")
    persona_voice: str = metadata.get("personaVoice", os.environ.get("XAI_VOICE", "Eve"))
    prior_messages: list[dict] = metadata.get("messages", [])

    logger.info(
        "Starting session | persona=%s | conversation=%s | prior_messages=%d",
        persona_name,
        conversation_id,
        len(prior_messages),
    )

    # Build initial chat context from prior text conversation so the agent
    # has full context when the user switches from text to voice.
    initial_ctx = agent_llm.ChatContext()
    for msg in prior_messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role == "user":
            initial_ctx.add_message(role="user", content=content)
        elif role == "assistant":
            initial_ctx.add_message(role="assistant", content=content)

    session = AgentSession(
        llm=xai.realtime.RealtimeModel(
            voice=persona_voice,
            api_key=os.environ["XAI_API_KEY"],
        ),
    )

    await session.start(
        room=ctx.room,
        agent=WitnessPersona(
            persona_name,
            persona_description,
            conversation_id,
            chat_ctx=initial_ctx if prior_messages else None,
        ),
    )

    logger.info("Agent session started for room: %s", ctx.room.name)

    # Greet the user to open the conversation
    await session.say(
        f"Hey, how's it going?",
        allow_interruptions=True,
    )


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(entrypoint_fnc=entrypoint)
    )
