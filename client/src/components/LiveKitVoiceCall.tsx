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

  // transcriptionReceived: primary real-time transcript source.
  // We use fixed IDs "interim-user" / "interim-assistant" so there is always
  // at most ONE in-progress bubble per role — xAI's many segment IDs all
  // collapse into the same slot via findIndex on the fixed ID.
  useEffect(() => {
    const handleTranscription = (segs: any[], participant: any) => {
      const isLocal = participant?.identity === room.localParticipant?.identity;
      const role: "user" | "assistant" = isLocal ? "user" : "assistant";
      // Use the last (most complete) text from this batch
      const latestText = [...segs].reverse().find((s) => s.text)?.text;
      if (!latestText) return;
      const interimId = `interim-${role}`;
      setSegments((prev) => {
        const updated = [...prev];
        const idx = updated.findIndex((s) => s.id === interimId);
        if (idx >= 0) {
          updated[idx] = { id: interimId, role, text: latestText };
        } else {
          // Only add if no DB-confirmed bubble already exists for this role
          // at the tail (i.e. the turn hasn't been confirmed yet)
          updated.push({ id: interimId, role, text: latestText });
        }
        return updated;
      });
    };
    room.on("transcriptionReceived", handleTranscription);
    return () => { room.off("transcriptionReceived", handleTranscription); };
  }, [room]);

  // DB poll: authoritative source. When a message is confirmed in the DB,
  // replace the interim-{role} bubble (if present) with the final text,
  // or add it if there was no interim bubble.
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
          let updated = [...prev];
          for (const msg of newMsgs) {
            const role: "user" | "assistant" = msg.role === "user" ? "user" : "assistant";
            const syntheticId = `db-${msg.id}`;
            if (updated.some((s) => s.id === syntheticId)) continue;
            // Replace interim bubble if present, otherwise append
            const interimIdx = updated.findIndex((s) => s.id === `interim-${role}`);
            if (interimIdx >= 0) {
              updated[interimIdx] = { id: syntheticId, role, text: msg.content };
            } else {
              // No interim bubble — only add if not a content duplicate
              const norm = (t: string) => t.toLowerCase().replace(/[^\w ]/g, "").trim();
              if (!updated.some((s) => s.role === role && norm(s.text) === norm(msg.content))) {
                updated.push({ id: syntheticId, role, text: msg.content });
              }
            }
          }
          return updated;
        });
      } catch {}
    };

    poll(); // run immediately on mount
    const interval = setInterval(poll, 1000);
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
    // All transcript text comes from the DB poll now — no local-only segments to flush.
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
        {segments.length === 0 && state !== "listening" && (
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

        {/* Typing indicators — shown while a turn is in progress, disappear when DB confirms */}
        {state === "listening" && (
          <div className="flex w-full max-w-3xl mx-auto justify-end">
            <div className="rounded-2xl rounded-tr-sm px-4 py-3 bg-primary/20 text-xs text-primary italic">
              speaking…
            </div>
          </div>
        )}
        {(state === "thinking" || state === "speaking") && (
          <div className="flex w-full max-w-3xl mx-auto justify-start">
            <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-card border border-border/50 text-xs text-muted-foreground italic">
              {personaName ?? "Agent"} is {state === "thinking" ? "thinking…" : "speaking…"}
            </div>
          </div>
        )}
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
