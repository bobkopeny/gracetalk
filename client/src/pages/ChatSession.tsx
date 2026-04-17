import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useConversation, useGenerateFeedback } from "@/hooks/use-conversations";
import { usePersona } from "@/hooks/use-personas";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Phone, ArrowLeft, HelpCircle, CheckCircle2 } from "lucide-react";
import { LiveKitVoiceCall } from "@/components/LiveKitVoiceCall";

export default function ChatSession() {
  const { id } = useParams();
  const conversationId = Number(id);
  const [, setLocation] = useLocation();

  const { data: conversation, isLoading, refetch } = useConversation(conversationId);
  const { data: persona } = usePersona(conversation?.personaId || 0);
  const generateFeedback = useGenerateFeedback();

  const startCallRef = useRef<(() => void) | null>(null);
  const [callActive, setCallActive] = useState(false);
  const [callConnecting, setCallConnecting] = useState(false);

  const handleActiveChange = (active: boolean) => {
    setCallActive(active);
    if (active) setCallConnecting(false);
  };

  const handleStartVoice = () => {
    setCallConnecting(true);
    startCallRef.current?.();
  };

  const handleVoiceCallEnd = async () => {
    setCallActive(false);
    let lastCount = conversation?.messages?.length ?? 0;
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const result = await refetch();
      const newCount = result.data?.messages?.length ?? 0;
      if (newCount === lastCount && i >= 2) break;
      lastCount = newCount;
    }
    generateFeedback.mutate(conversationId, {
      onSuccess: () => setLocation(`/feedback/${conversationId}`),
    });
  };

  const handleEndManual = () => {
    generateFeedback.mutate(conversationId, {
      onSuccess: () => setLocation(`/feedback/${conversationId}`),
    });
  };

  if (isLoading || !conversation) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const hasMessages = conversation.messages.length > 0;

  return (
    <div className="min-h-screen bg-muted/20 md:pl-64 flex flex-col h-screen overflow-hidden">
      <Navigation />

      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 shrink-0 shadow-sm z-10">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => setLocation("/dashboard")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold shrink-0">
          {persona?.name?.[0] ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground leading-none truncate">{persona?.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Practice Session</p>
        </div>
        {hasMessages && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleEndManual}
            disabled={generateFeedback.isPending}
            className="gap-2 shrink-0"
          >
            {generateFeedback.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">End &amp; Get Feedback</span>
            <span className="sm:hidden">Feedback</span>
          </Button>
        )}
      </div>

      {/* Pre-call centered content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6 text-center">
        {/* Persona description */}
        {persona?.description && (
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed line-clamp-3">
            {persona.description}
          </p>
        )}

        {/* Big phone icon */}
        <div className="w-28 h-28 rounded-full bg-teal-600 flex items-center justify-center shadow-lg">
          <Phone className="w-14 h-14 text-white" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Real-time Voice Chat</h1>
          <p className="text-muted-foreground max-w-xs">
            Experience instant, natural conversation with{" "}
            <span className="font-medium text-foreground">{persona?.name ?? "your persona"}</span>.
            Just like talking on the phone — no waiting!
          </p>
        </div>

        <Button
          className="bg-teal-600 hover:bg-teal-700 text-white px-10 h-12 rounded-full text-base gap-2 shadow-md"
          onClick={handleStartVoice}
          disabled={callConnecting || callActive}
        >
          {callConnecting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Phone className="w-5 h-5" />
          )}
          {callConnecting ? "Connecting..." : "Start Conversation"}
        </Button>

        <p className="text-xs text-muted-foreground">Tap to start conversation</p>

        {hasMessages && (
          <p className="text-xs text-muted-foreground">
            This session already has {conversation.messages.length} saved messages.
          </p>
        )}
      </div>

      {/* LiveKitVoiceCall — hidden trigger, managed via startCallRef */}
      <LiveKitVoiceCall
        conversationId={conversationId}
        personaName={persona?.name}
        startCallRef={startCallRef}
        onConnectingChange={setCallConnecting}
        onActiveChange={handleActiveChange}
        onTranscriptsUpdated={refetch}
        onCallEnded={handleVoiceCallEnd}
        onSwitchToType={() => refetch()}
      />
    </div>
  );
}
