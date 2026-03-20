import { useState, useCallback } from "react";
import {
  LiveKitRoom,
  useVoiceAssistant,
  BarVisualizer,
  RoomAudioRenderer,
  DisconnectButton,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Loader2, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveKitVoiceCallProps {
  conversationId?: number;
  personaId?: string; // for demo/guest mode
  onTranscriptsUpdated?: () => void;
  onActiveChange?: (active: boolean) => void;
}

function VoiceCallActive({ onHangup, micUnavailable }: { onHangup: () => void; micUnavailable: boolean }) {
  const { state, audioTrack } = useVoiceAssistant();

  const stateLabel: Record<string, string> = {
    disconnected: "Disconnected",
    connecting: "Connecting...",
    initializing: "Starting...",
    listening: "Listening...",
    thinking: "Thinking...",
    speaking: "Speaking...",
  };

  const isLive = ["listening", "thinking", "speaking"].includes(state);

  return (
    <div className="flex items-center gap-3">
      {micUnavailable && (
        <span className="flex items-center gap-1 text-xs text-amber-600 font-medium hidden sm:flex">
          <MicOff className="w-3 h-3" />
          No mic
        </span>
      )}

      {/* Compact visualizer */}
      <div className="w-20 h-8 flex items-center">
        <BarVisualizer
          state={state}
          barCount={5}
          trackRef={audioTrack}
          className="w-full"
          options={{ minHeight: 3 }}
        />
      </div>

      <span className={cn(
        "text-xs font-medium hidden sm:block",
        isLive ? "text-primary" : "text-muted-foreground"
      )}>
        {stateLabel[state] ?? "Connected"}
      </span>

      <DisconnectButton onClick={onHangup}>
        <Button variant="destructive" size="sm" className="gap-1.5 rounded-lg" asChild>
          <span>
            <PhoneOff className="w-3.5 h-3.5" />
            End
          </span>
        </Button>
      </DisconnectButton>

      <RoomAudioRenderer />
    </div>
  );
}

export function LiveKitVoiceCall({ conversationId, personaId, onTranscriptsUpdated, onActiveChange }: LiveKitVoiceCallProps) {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [micUnavailable, setMicUnavailable] = useState(false);

  const isDemo = !!personaId;

  const startCall = useCallback(async () => {
    setIsConnecting(true);
    setMicUnavailable(false);
    try {
      // Request mic permission — non-fatal if device not found (listen-only mode)
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch (micErr: any) {
        if (micErr?.name === "NotAllowedError" || micErr?.name === "PermissionDeniedError") {
          alert("Microphone access was denied. Please allow microphone access in your browser settings and try again.");
          setIsConnecting(false);
          return;
        }
        // NotFoundError or other — no mic available, proceed in listen-only mode
        console.warn("No microphone found, connecting in listen-only mode:", micErr?.message);
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
      setIsActive(true);
      onActiveChange?.(true);
    } catch (e: any) {
      console.error("LiveKit voice call error:", e);
      alert("Could not start voice call: " + (e?.message ?? "Unknown error"));
    } finally {
      setIsConnecting(false);
    }
  }, [conversationId, personaId, isDemo, onActiveChange]);

  const endCall = useCallback(() => {
    setIsActive(false);
    setToken(null);
    setServerUrl(null);
    setMicUnavailable(false);
    onActiveChange?.(false);
    setTimeout(() => onTranscriptsUpdated?.(), 1500);
  }, [onTranscriptsUpdated, onActiveChange]);

  if (!isActive || !token || !serverUrl) {
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
      onDisconnected={endCall}
    >
      <VoiceCallActive onHangup={endCall} micUnavailable={micUnavailable} />
    </LiveKitRoom>
  );
}
