import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  LiveKitRoom,
  useVoiceAssistant,
  BarVisualizer,
  RoomAudioRenderer,
  useRoomContext,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Loader2, MicOff, Keyboard, HelpCircle, Lightbulb, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TranscriptSegment {
  id: string;
  role: "user" | "assistant";
  text: string;
}

function VoiceSession({
  conversationId,
  onEnd,
  onSwitchToType,
  micUnavailable,
  personaName,
}: {
  conversationId?: number;
  onEnd: () => void;
  onSwitchToType?: () => void;
  micUnavailable: boolean;
  personaName?: string;
}) {
  const { state, audioTrack } = useVoiceAssistant();
  const room = useRoomContext();
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Tracks the ID of the currently "in-progress" (non-final) segment per role.
  // xAI's LiveKit integration sends a NEW segment ID for every interim transcription
  // update rather than reusing the same ID, so we collapse them into one bubble.
  const activeSegRef = useRef<Partial<Record<"user" | "assistant", string>>>({});
  // After the DB confirms a turn, lock that role briefly so late-arriving
  // transcriptionReceived events from the same xAI utterance can't create new bubbles.
  const turnLockExpiry = useRef<Partial<Record<"user" | "assistant", number>>>({});

  // Listen for native LiveKit transcription events (may not fire with xAI realtime)
  useEffect(() => {
    const handleTranscription = (segs: any[], participant: any) => {
      const isLocal = participant?.identity === room.localParticipant?.identity;
      const role: "user" | "assistant" = isLocal ? "user" : "assistant";
      // If this role is locked (DB just confirmed its last turn), ignore late
      // interim events from the same xAI utterance to prevent phantom bubbles.
      const lock = turnLockExpiry.current[role];
      if (lock && Date.now() < lock) return;
      setSegments((prev) => {
        const updated = [...prev];
        for (const seg of segs) {
          const existingIdx = updated.findIndex((s) => s.id === seg.id);
          if (existingIdx >= 0) {
            // Known ID — update text in-place, keep activeRef pointing here
            updated[existingIdx] = { id: seg.id, role, text: seg.text };
          } else {
            // New segment ID — overwrite the active bubble if one exists,
            // otherwise start a fresh bubble.
            // We do NOT rely on seg.final to decide: xAI may mark every
            // interim segment as final, which would defeat that check.
            // The DB poll is the authoritative signal that a turn is done.
            const activeId = activeSegRef.current[role];
            const activeIdx = activeId ? updated.findIndex((s) => s.id === activeId) : -1;
            if (activeIdx >= 0) {
              updated[activeIdx] = { id: seg.id, role, text: seg.text };
            } else {
              updated.push({ id: seg.id, role, text: seg.text });
            }
            // Always track the latest ID so the next interim update finds it
            activeSegRef.current[role] = seg.id;
          }
        }
        return updated;
      });
    };

    room.on("transcriptionReceived", handleTranscription);
    return () => {
      room.off("transcriptionReceived", handleTranscription);
    };
  }, [room]);

  // Fallback: poll DB for messages saved by the agent (xAI plugin doesn't forward transcription events).
  // The DB poll is also the authoritative "turn complete" signal: when a message lands in the DB
  // we replace whatever interim bubble exists for that role with the final saved text, then clear
  // activeSegRef so the next utterance starts a brand-new bubble.
  useEffect(() => {
    if (!conversationId) return;
    const seenIds = new Set<number>();

    const poll = async () => {
      try {
        const res = await fetch(`/api/conversations/${conversationId}`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        const msgs: Array<{ id: number; role: string; content: string }> = data.messages ?? [];
        const newMsgs = msgs.filter((m) => !seenIds.has(m.id));
        if (newMsgs.length === 0) return;
        newMsgs.forEach((m) => seenIds.add(m.id));
        setSegments((prev) => {
          const updated = [...prev];
          for (const msg of newMsgs) {
            const role: "user" | "assistant" = msg.role === "user" ? "user" : "assistant";
            const syntheticId = `db-${msg.id}`;

            // Already stored by ID — skip
            if (updated.find((s) => s.id === syntheticId)) continue;

            // If there is an active interim bubble for this role, replace it
            // with the authoritative DB text and close the turn.
            const activeId = activeSegRef.current[role];
            const activeIdx = activeId ? updated.findIndex((s) => s.id === activeId) : -1;
            if (activeIdx >= 0) {
              updated[activeIdx] = { id: syntheticId, role, text: msg.content };
            } else {
              // No interim bubble — remove any stale non-db interim for this role,
              // then add the confirmed DB message (skip if content already shown).
              const normalize = (t: string) =>
                t.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
              const duplicate = updated.find(
                (s) =>
                  s.role === role &&
                  (s.id === syntheticId ||
                    normalize(s.text) === normalize(msg.content))
              );
              if (!duplicate) {
                // Remove any orphaned non-db interim bubble for this role before adding DB version
                const orphanIdx = updated.findIndex(
                  (s) => s.role === role && !s.id.startsWith("db-")
                );
                if (orphanIdx >= 0) updated.splice(orphanIdx, 1);
                updated.push({ id: syntheticId, role, text: msg.content });
              }
            }
            // Lock this role for 1.5 s so late xAI interim events don't spawn new bubbles
            turnLockExpiry.current[role] = Date.now() + 1500;
            delete activeSegRef.current[role]; // turn is done — next utterance gets a fresh bubble
          }
          return updated;
        });
      } catch {}
    };

    const interval = setInterval(poll, 2500);
    return () => clearInterval(interval);
  }, [conversationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments]);

  const isLive = ["listening", "thinking", "speaking"].includes(state);

  const stateLabel: Record<string, string> = {
    disconnected: "Disconnected",
    connecting: "Connecting...",
    initializing: "Starting...",
    listening: "Listening...",
    thinking: "Thinking...",
    speaking: "Speaking...",
  };

  const handleEndClick = async () => {
    if (conversationId && segments.length > 0) {
      // Only send segments NOT already in the DB (db-* ids are already saved).
      // Of the remaining interim segments, keep only the last one per role —
      // that's the most complete version. Earlier partial bubbles ("Yeah.",
      // "Yeah, I wanna") should never reach the DB as separate messages.
      const fallbackByRole = new Map<string, string>();
      for (const seg of segments) {
        if (!seg.id.startsWith("db-")) {
          fallbackByRole.set(seg.role, seg.text); // last one per role wins
        }
      }
      const fallbackSegments = Array.from(fallbackByRole.entries()).map(
        ([role, text]) => ({ role, text })
      );
      if (fallbackSegments.length > 0) {
        fetch(`/api/conversations/${conversationId}/voice-transcript`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ segments: fallbackSegments }),
        }).catch(() => {});
      }
    }
    await room.disconnect();
    onEnd();
  };

  const handleTypeClick = () => {
    onSwitchToType?.();          // switch UI immediately
    room.disconnect().catch(() => {});  // disconnect in background
  };

  const handleHelp = async () => {
    if (!conversationId) return;
    setHintLoading(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/help`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      setHint(data.hint);
    } finally {
      setHintLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 md:pl-64 bg-background z-30 flex flex-col">
      {/* Status bar */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 shrink-0 shadow-sm">
        <div className="w-10 h-7 shrink-0">
          <BarVisualizer
            state={state}
            barCount={5}
            trackRef={audioTrack}
            className="w-full h-full"
            options={{ minHeight: 2 }}
          />
        </div>
        <span
          className={cn(
            "text-sm font-medium",
            isLive ? "text-primary" : "text-muted-foreground"
          )}
        >
          {stateLabel[state] ?? "Connected"}
        </span>
        {micUnavailable && (
          <span className="flex items-center gap-1 text-xs text-amber-600">
            <MicOff className="w-3 h-3" />
            No mic
          </span>
        )}
        {personaName && (
          <span className="ml-auto text-xs font-medium text-muted-foreground truncate max-w-[120px]">
            {personaName}
          </span>
        )}
      </div>

      {/* Transcript area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4" ref={scrollRef}>
        {segments.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">Speak naturally to begin...</p>
          </div>
        )}
        {segments.map((seg) => {
          const isUser = seg.role === "user";
          return (
            <div
              key={seg.id}
              className={cn(
                "flex w-full max-w-3xl mx-auto animate-in",
                isUser ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 shadow-sm text-sm leading-relaxed space-y-1",
                  isUser
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-card text-card-foreground rounded-tl-sm border border-border/50"
                )}
              >
                <p
                  className={cn(
                    "text-[10px] font-medium",
                    isUser ? "opacity-70" : "text-muted-foreground"
                  )}
                >
                  {isUser ? "You" : personaName}
                </p>
                <p>{seg.text}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Help hint banner */}
      {hint && (
        <div className="bg-amber-50 border-t border-amber-200 px-4 py-3 flex items-start gap-3 shrink-0">
          <Lightbulb className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800 flex-1">{hint}</p>
          <button onClick={() => setHint(null)} className="text-amber-400 hover:text-amber-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="bg-card border-t border-border p-4 shrink-0">
        <div className="max-w-sm mx-auto flex flex-col items-center gap-3">
          <div className="flex gap-3">
            <Button
              variant="destructive"
              className="gap-2 px-6"
              onClick={handleEndClick}
            >
              <PhoneOff className="w-4 h-4" />
              End
            </Button>
            {onSwitchToType && (
              <Button
                variant="outline"
                className="gap-2 px-4"
                onClick={handleTypeClick}
              >
                <Keyboard className="w-4 h-4" />
                Type
              </Button>
            )}
            {conversationId && (
              <Button
                variant="outline"
                className="gap-2 px-4"
                onClick={handleHelp}
                disabled={hintLoading}
              >
                {hintLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <HelpCircle className="w-4 h-4" />
                )}
                Help
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Speak naturally – or tap Type to write instead
          </p>
        </div>
      </div>

      <RoomAudioRenderer />
    </div>,
    document.body
  );
}

interface LiveKitVoiceCallProps {
  conversationId?: number;
  personaId?: string;
  personaName?: string;
  onTranscriptsUpdated?: () => void;
  onActiveChange?: (active: boolean) => void;
  onCallEnded?: () => void;
  onSwitchToType?: () => void;
  startCallRef?: React.MutableRefObject<(() => void) | null>;
  onConnectingChange?: (connecting: boolean) => void;
  onMoodIndex?: (index: number) => void;
}

export function LiveKitVoiceCall({
  conversationId,
  personaId,
  personaName,
  onTranscriptsUpdated,
  onActiveChange,
  onCallEnded,
  onSwitchToType,
  startCallRef,
  onConnectingChange,
  onMoodIndex,
}: LiveKitVoiceCallProps) {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [micUnavailable, setMicUnavailable] = useState(false);
  const switchingToTypeRef = useRef(false);

  const isDemo = !!personaId;

  const startCall = useCallback(async () => {
    setIsConnecting(true);
    onConnectingChange?.(true);
    setMicUnavailable(false);
    try {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch (micErr: any) {
        if (
          micErr?.name === "NotAllowedError" ||
          micErr?.name === "PermissionDeniedError"
        ) {
          alert(
            "Microphone access was denied. Please allow microphone access in your browser settings and try again."
          );
          setIsConnecting(false);
          return;
        }
        console.warn(
          "No microphone found, connecting in listen-only mode:",
          micErr?.message
        );
        setMicUnavailable(true);
      }

      const endpoint = isDemo ? "/api/demo/livekit/token" : "/api/livekit/token";
      const body = isDemo ? { personaId } : { conversationId };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Failed to get LiveKit token");
      }

      const data = await res.json();
      setToken(data.token);
      setServerUrl(data.url);
      if (typeof data.moodIndex === "number") onMoodIndex?.(data.moodIndex);
      setIsActive(true);
      onActiveChange?.(true);
    } catch (e: any) {
      console.error("LiveKit voice call error:", e);
      alert("Could not start voice call: " + (e?.message ?? "Unknown error"));
    } finally {
      setIsConnecting(false);
      onConnectingChange?.(false);
    }
  }, [conversationId, personaId, isDemo, onActiveChange, onConnectingChange]);

  useEffect(() => {
    if (startCallRef) startCallRef.current = startCall;
  }, [startCall, startCallRef]);

  const handleDisconnected = useCallback(() => {
    setIsActive(false);
    setToken(null);
    setServerUrl(null);
    setMicUnavailable(false);
    onActiveChange?.(false);

    if (switchingToTypeRef.current) {
      // UI already switched — just schedule a transcript refresh
      switchingToTypeRef.current = false;
      setTimeout(() => onTranscriptsUpdated?.(), 1500);
    } else if (onCallEnded) {
      onCallEnded();
    } else {
      setTimeout(() => onTranscriptsUpdated?.(), 1500);
    }
  }, [onTranscriptsUpdated, onActiveChange, onCallEnded]);

  if (!isActive || !token || !serverUrl) {
    if (startCallRef) return null;
    return (
      <Button
        onClick={startCall}
        disabled={isConnecting}
        variant="outline"
        size="sm"
        className="gap-2 rounded-lg"
      >
        {isConnecting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Phone className="w-3.5 h-3.5" />
        )}
        {isConnecting ? "Connecting..." : "Voice Call"}
      </Button>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      audio={!micUnavailable}
      video={false}
      onDisconnected={handleDisconnected}
    >
      <VoiceSession
        conversationId={conversationId}
        onEnd={() => {}}
        onSwitchToType={onSwitchToType !== undefined ? () => {
          switchingToTypeRef.current = true;
          onSwitchToType();
        } : undefined}
        micUnavailable={micUnavailable}
        personaName={personaName}
      />
    </LiveKitRoom>
  );
}
