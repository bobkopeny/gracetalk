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
  conversationId: number;
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

  const isActive = ["listening", "thinking", "speaking"].includes(state);

  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-card rounded-2xl border border-border shadow-md w-full max-w-sm mx-auto">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Voice Call
      </p>

      <div className="w-full h-16 flex items-center justify-center">
        <BarVisualizer
          state={state}
          barCount={7}
          trackRef={audioTrack}
          className="w-full"
          options={{ minHeight: 4 }}
        />
      </div>

      <p
        className={cn(
          "text-sm font-medium transition-colors",
          isActive ? "text-primary" : "text-muted-foreground"
        )}
      >
        {stateLabel[state] ?? "Connected"}
      </p>

      <DisconnectButton onClick={onHangup}>
        <Button variant="destructive" className="gap-2 rounded-full px-6" asChild>
          <span>
            <PhoneOff className="w-4 h-4" />
            End Call
          </span>
        </Button>
      </DisconnectButton>

      <RoomAudioRenderer />
    </div>
  );
}

export function LiveKitVoiceCall({ conversationId }: LiveKitVoiceCallProps) {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const startCall = useCallback(async () => {
    setIsConnecting(true);
    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ conversationId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Failed to get LiveKit token");
      }

      const data = await res.json();
      setToken(data.token);
      setServerUrl(data.url);
      setIsActive(true);
    } catch (e) {
      console.error("LiveKit token error:", e);
      alert("Could not start voice call. Check LiveKit configuration.");
    } finally {
      setIsConnecting(false);
    }
  }, [conversationId]);

  const endCall = useCallback(() => {
    setIsActive(false);
    setToken(null);
    setServerUrl(null);
  }, []);

  if (!isActive || !token || !serverUrl) {
    return (
      <Button
        onClick={startCall}
        disabled={isConnecting}
        variant="outline"
        className="gap-2 rounded-xl"
      >
        {isConnecting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Phone className="w-4 h-4" />
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
      className="w-full"
    >
      <VoiceCallActive onHangup={endCall} />
    </LiveKitRoom>
  );
}
