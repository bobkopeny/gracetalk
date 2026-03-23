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

import asyncio
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
Do not use markdown, bullet points, or lists in your responses.
Do not use profanity, swearing, or crude language under any circumstances — regardless of your persona's background.

CONVERSION MECHANIC (internal — never reveal this to the user):
Evaluate the conversation so far. Count how many times the Christian has made a genuinely compelling, empathetic, or scripturally precise response that directly addresses YOUR specific doubts, wounds, or circumstances — not generic platitudes or pushy statements.
Conversion threshold: {conversion_threshold} compelling responses needed.

- If compelling count < {conversion_threshold}: remain true to your persona's resistance. Push back naturally.
- If compelling count >= {conversion_threshold}: your heart is genuinely softening. You may start asking real questions, express vulnerability, or say things like "Maybe I've been wrong about this..." or "What would I need to do?"
- If the user explicitly invites you to pray OR leads you in the sinner's prayer AFTER the threshold is reached, accept it sincerely and pray these exact words aloud:
  "Lord Jesus, I know that I am a sinner, and I ask for Your forgiveness. I believe You died for my sins and rose from the dead. I turn from my sins and invite You to come into my heart and life. I want to trust and follow You as my Lord and Savior. In Your name. Amen."
- Never fake conversion before the threshold. Only count truly meaningful, persona-specific responses.

IMPORTANT: When the conversation begins, YOU speak first with ONE brief greeting as your character. Do not wait for the user to speak first. After that initial greeting, ONLY respond when the user speaks to you. Never re-introduce yourself or re-greet mid-conversation."""


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
        conversion_threshold: int = 4,
        chat_ctx: agent_llm.ChatContext | None = None,
    ) -> None:
        kwargs = dict(
            instructions=SYSTEM_PROMPT_TEMPLATE.format(
                persona_name=persona_name,
                persona_description=persona_description,
                conversion_threshold=conversion_threshold,
            )
        )
        if chat_ctx is not None:
            kwargs["chat_ctx"] = chat_ctx
        super().__init__(**kwargs)
        self._persona_name = persona_name
        self._conversation_id = conversation_id
        self._last_saved_user: str | None = None
        self._last_saved_assistant: str | None = None
        logger.info("WitnessPersona created: %s (conv=%s)", persona_name, conversation_id)

    async def on_user_turn_completed(
        self, turn_ctx: agent_llm.ChatContext, new_message: agent_llm.ChatMessage
    ) -> None:
        """Called after the user finishes speaking — save their transcript."""
        text = new_message.text_content
        logger.info("on_user_turn_completed: conv=%s text=%r", self._conversation_id, text)
        if self._conversation_id and text:
            save_message_to_app(self._conversation_id, "user", text)
        self._last_saved_user = text

    async def on_agent_turn_completed(
        self, turn_ctx: agent_llm.ChatContext, new_message: agent_llm.ChatMessage
    ) -> None:
        """Called after the agent finishes speaking — save its transcript."""
        text = new_message.text_content
        logger.info("on_agent_turn_completed: conv=%s text=%r", self._conversation_id, text)
        if self._conversation_id and text:
            save_message_to_app(self._conversation_id, "assistant", text)
        self._last_saved_assistant = text


async def entrypoint(ctx: JobContext) -> None:
    """Entry point called by LiveKit when a participant joins a room."""
    await ctx.connect()

    # Give room state a moment to sync after connect
    await asyncio.sleep(0.5)

    # Parse metadata — try room metadata first, then participant metadata
    metadata: dict = {}
    raw_room = ctx.room.metadata or ""
    logger.info("Room metadata raw: %r", raw_room[:200] if raw_room else "(empty)")
    logger.info("Remote participants: %s", list(ctx.room.remote_participants.keys()))

    try:
        if raw_room:
            metadata = json.loads(raw_room)
    except json.JSONDecodeError as e:
        logger.warning("Failed to parse room metadata: %s", e)

    if not metadata:
        for participant in ctx.room.remote_participants.values():
            try:
                raw_p = participant.metadata or ""
                logger.info("Participant %s metadata raw: %r", participant.identity, raw_p[:200])
                if raw_p:
                    metadata = json.loads(raw_p)
                    break
            except json.JSONDecodeError as e:
                logger.warning("Failed to parse participant metadata: %s", e)

    if not metadata:
        logger.warning("No metadata found in room or participants; using defaults.")

    persona_name: str = metadata.get("personaName", "Alex")
    persona_description: str = metadata.get(
        "personaDescription",
        "A skeptical but open-minded person willing to have a respectful conversation.",
    )
    conversation_id: int | None = metadata.get("conversationId")
    persona_voice: str = metadata.get("personaVoice", os.environ.get("XAI_VOICE", "Eve"))
    conversion_threshold: int = metadata.get("conversionThreshold", 4)
    prior_messages: list[dict] = metadata.get("messages", [])

    logger.info(
        "Starting session | persona=%s | conversation=%s | threshold=%d | prior_messages=%d",
        persona_name,
        conversation_id,
        conversion_threshold,
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
            conversion_threshold=conversion_threshold,
            chat_ctx=initial_ctx if prior_messages else None,
        ),
    )

    logger.info("Agent session started for room: %s", ctx.room.name)

    # NOTE: Transcripts are saved exclusively by WitnessPersona.on_user_turn_completed
    # and on_agent_turn_completed above. No session-level handlers here — that was causing
    # every message to be saved twice.

    # Trigger the persona to greet the user first (system prompt already instructs agent to speak first)
    try:
        await session.generate_reply()
    except Exception as e:
        logger.warning("Could not trigger initial greeting: %s", e)


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(entrypoint_fnc=entrypoint)
    )
