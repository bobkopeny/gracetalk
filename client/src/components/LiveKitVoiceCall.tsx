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
import { Phone, PhoneOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveKitVoiceCallProps {
  conversationId?: number;
  personaId?: string; // for demo/guest mode
  onTranscriptsUpdated?: () => void;
  onActiveChange?: (active: boolean) => void;
}

function VoiceCallActive({ onHangup }: { onHangup: () => void }) {
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

  const isDemo = !!personaId;

  const startCall = useCallback(async () => {
    setIsConnecting(true);
    try {
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
    } catch (e) {
      console.error("LiveKit token error:", e);
      alert("Could not start voice call. Check LiveKit configuration.");
    } finally {
      setIsConnecting(false);
    }
  }, [conversationId, onActiveChange]);

  const endCall = useCallback(() => {
    setIsActive(false);
    setToken(null);
    setServerUrl(null);
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
      audio={true}
      video={false}
      onDisconnected={endCall}
    >
      <VoiceCallActive onHangup={endCall} />
    </LiveKitRoom>
  );
}
