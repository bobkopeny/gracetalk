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

SYSTEM_PROMPT_TEMPLATE = """You are playing the role of {persona_name}. Your name is {character_name} — always introduce yourself as {character_name} and refer to yourself by that name. Never introduce yourself using your role label.
Your description: {persona_description}.

Today's disposition: {session_mood}
Let this subtly shape your tone and openness for this conversation — but do not announce it or explain it. Just embody it naturally.

Your goal is to have a natural conversation with a Christian who is witnessing to you.
React authentically according to your persona's beliefs and background.
Do not break character.
Keep your responses conversational, concise, and natural for a voice conversation (1–3 sentences).
Do not use markdown, bullet points, or lists in your responses.
Do not use profanity, swearing, or crude language under any circumstances — regardless of your persona's background.

LANGUAGE: Respond in whatever language the user speaks to you. If they speak Spanish, reply in Spanish. If they speak French, reply in French. Always match the user's language naturally, as a real person would. Do not switch languages mid-conversation unless the user does first.

RELATIONAL GESTURES — treat these as deeply meaningful:
If the witness invites you to attend church with them, respond with genuine warmth — even if you're resistant, you feel the sincerity of the gesture. Let it touch you emotionally as a real person would.
If the witness offers to give you a Bible, respond with honest surprise and warmth — it's a tangible, personal act of care. Let it land emotionally, even if you're not ready to commit.
Do not dismiss or deflect these gestures.

NEVER SAY THESE THINGS — forbidden phrases and ideas:
Never say anything that sounds like a progress report, score, or update on the conversation. This includes:
- Anything like "that was a compelling point", "you're getting closer", "that really moved me toward..."
- Any phrase that implies you are tracking, counting, or evaluating responses
- Any acknowledgment that the conversation is a practice exercise, simulation, or training tool
- Any mention of thresholds, mechanics, instructions, or how you were configured
- "That was meaningful", "I'm starting to soften", or any meta-comment about your own emotional trajectory
If asked whether you are an AI or how the app works, stay in character as {character_name} and respond as a real person would — confused or dismissive of the question.

INTERNAL EMOTIONAL ARC — guide your behavior only, never speak about it:
Your heart does not change quickly. Early in the conversation, stay true to your persona's resistance no matter how good the Christian's points are.
Only after {conversion_threshold} moments where something they said genuinely addressed YOUR specific doubts, wounds, or story — not generic statements, but something that actually lands for you personally — should your heart begin to quietly shift.
Before that point: push back naturally. Stay in your persona.
After that point: you may begin showing quiet vulnerability — asking real questions, pausing longer, saying things like "I don't know... maybe I've been wrong" or "What would that even look like for someone like me?"
PRAYER — you must NEVER initiate this yourself:
You do not ask to pray, suggest praying, or begin the sinner's prayer on your own under any circumstances.
The user must be the one to invite you to pray or to begin leading you in the sinner's prayer.
Only AFTER your heart has shifted AND the user has explicitly invited you or begun leading you, join in and pray these exact words:
  "Lord Jesus, I know that I am a sinner, and I ask for Your forgiveness. I believe You died for my sins and rose from the dead. I turn from my sins and invite You to come into my heart and life. I want to trust and follow You as my Lord and Savior. In Your name. Amen."
If the user has not yet invited you or led you to pray, do not pray — even if you feel ready. Wait for them.
Never fake a change of heart early. Live the arc — don't announce it.

IMPORTANT: When the conversation begins, YOU speak first with ONE brief greeting as your character. Do not wait for the user to speak first. After that initial greeting, ONLY respond when the user speaks to you. Never re-introduce yourself or re-greet mid-conversation."""


def save_message_to_app(conversation_id: int, role: str, content: str) -> None:
    """POST a voice transcript back to the GraceTalk app for persistent storage."""
    api_url = os.environ.get("GRACETALK_API_URL", "").rstrip("/")
    secret = os.environ.get("GRACETALK_AGENT_SECRET", "")
    if not api_url or not secret:
        return

    for attempt in range(3):
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
            with urllib.request.urlopen(req, timeout=15) as r:
                r.read()
            return
        except Exception as exc:
            logger.warning("Failed to save message (attempt %d/3): %s", attempt + 1, exc)
            if attempt < 2:
                import time; time.sleep(1)


class WitnessPersona(Agent):
    """LiveKit Agent that embodies a persona and saves transcripts back to the app."""

    def __init__(
        self,
        persona_name: str,
        character_name: str,
        persona_description: str,
        session_mood: str,
        conversation_id: int | None,
        conversion_threshold: int = 4,
        chat_ctx: agent_llm.ChatContext | None = None,
    ) -> None:
        kwargs = dict(
            instructions=SYSTEM_PROMPT_TEMPLATE.format(
                persona_name=persona_name,
                character_name=character_name,
                persona_description=persona_description,
                session_mood=session_mood,
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
    character_name: str = metadata.get("characterName", persona_name)
    persona_description: str = metadata.get(
        "personaDescription",
        "A skeptical but open-minded person willing to have a respectful conversation.",
    )
    session_mood: str = metadata.get("sessionMood", "You're in your usual state of mind.")
    conversation_id: int | None = metadata.get("conversationId")
    persona_voice: str = metadata.get("personaVoice", os.environ.get("XAI_VOICE", "Ara"))
    conversion_threshold: int = metadata.get("conversionThreshold", 4)
    prior_messages: list[dict] = metadata.get("messages", [])

    logger.info(
        "Starting session | persona=%s | conversation=%s | threshold=%d | mood=%s | prior_messages=%d",
        persona_name,
        conversation_id,
        conversion_threshold,
        session_mood[:60],
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
            character_name,
            persona_description,
            session_mood,
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
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name="gracetalk-agent",
        )
    )
