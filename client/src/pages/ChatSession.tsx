import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useConversation, useGenerateFeedback, useSendMessage } from "@/hooks/use-conversations";
import { usePersona } from "@/hooks/use-personas";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Phone, ArrowLeft, CheckCircle2, Send, Keyboard, RefreshCw, BarChart2 } from "lucide-react";
import { LiveKitVoiceCall } from "@/components/LiveKitVoiceCall";
import { Link } from "wouter";

export default function ChatSession() {
  const { id } = useParams();
  const conversationId = Number(id);
  const [, setLocation] = useLocation();

  const { data: conversation, isLoading, refetch } = useConversation(conversationId);
  const { data: persona } = usePersona(conversation?.personaId || 0);
  const generateFeedback = useGenerateFeedback();
  const sendMessage = useSendMessage();

  const startCallRef = useRef<(() => void) | null>(null);
  const [callActive, setCallActive] = useState(false);
  const [callConnecting, setCallConnecting] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [input, setInput] = useState("");
  const moodIndexRef = useRef<number | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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
    // Poll up to 15 seconds for agent transcript saves to land in the DB.
    // Wait at least 6 polls (9s) before breaking on stability — a quick prayer
    // session might look stable early but the prayer text is still being saved.
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const result = await refetch();
      const newCount = result.data?.messages?.length ?? 0;
      if (newCount === lastCount && i >= 6) break;
      lastCount = newCount;
    }
    generateFeedback.mutate({ conversationId, moodIndex: moodIndexRef.current }, {
      onSuccess: () => setLocation(`/feedback/${conversationId}`),
    });
  };

  const handleEndManual = () => {
    generateFeedback.mutate({ conversationId, moodIndex: moodIndexRef.current }, {
      onSuccess: () => setLocation(`/feedback/${conversationId}`),
    });
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || sendMessage.isPending) return;
    setInput("");
    sendMessage.mutate({ conversationId, content: text });
  };

  // Scroll to bottom when messages update in text mode
  useEffect(() => {
    if (textMode) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation?.messages?.length, textMode]);

  if (isLoading || !conversation) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const hasMessages = conversation.messages.length > 0;
  const visibleMessages = conversation.messages.filter((m: any) => m.role !== "system");
  const isCompleted = (conversation as any).hasFeedback || conversation.converted;

  // ── Completed conversation: read-only view ────────────────────────────────
  if (isCompleted && !textMode && !callActive) {
    return (
      <div className="min-h-screen bg-muted/20 md:pl-64 flex flex-col">
        <Navigation />
        <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/history")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold shrink-0">
            {persona?.name?.[0] ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground leading-none truncate">{persona?.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {conversation.converted ? "Prayer Moment — Completed" : "Session Complete"}
            </p>
          </div>
        </div>

        {/* Completed banner */}
        <div className="mx-4 mt-4 rounded-xl border border-green-200 bg-green-50 p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-800">This session is complete.</p>
            <p className="text-xs text-green-700 mt-0.5">To practice with {persona?.name} again, start a fresh session — they'll have a different mood and openness level.</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mx-4 mt-3 flex gap-2">
          <Link href={`/feedback/${conversationId}`}>
            <Button variant="outline" className="gap-2 rounded-xl">
              <BarChart2 className="w-4 h-4" />
              View Feedback
            </Button>
          </Link>
          <Link href="/personas">
            <Button className="gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white">
              <RefreshCw className="w-4 h-4" />
              Start Fresh
            </Button>
          </Link>
        </div>

        {/* Read-only chat history */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 mt-2">
          {visibleMessages.map((msg: any) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm opacity-80 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-card border border-border text-foreground rounded-bl-sm"
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Text mode UI ──────────────────────────────────────────────────────────
  if (textMode) {
    return (
      <div className="min-h-screen bg-muted/20 md:pl-64 flex flex-col h-screen overflow-hidden">
        <Navigation />

        {/* Header */}
        <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 shrink-0 shadow-sm z-10">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setTextMode(false)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold shrink-0">
            {persona?.name?.[0] ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground leading-none truncate">{persona?.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Text Chat</p>
          </div>
          {hasMessages && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleEndManual}
              disabled={generateFeedback.isPending}
              className="gap-2 shrink-0"
            >
              {generateFeedback.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span className="hidden sm:inline">End &amp; Get Feedback</span>
              <span className="sm:hidden">Feedback</span>
            </Button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {visibleMessages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm mt-8">
              Say something to start the conversation.
            </div>
          )}
          {visibleMessages.map((msg: any) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card border border-border text-foreground rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {sendMessage.isPending && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-border bg-card p-3 flex gap-2">
          <input
            autoFocus
            className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <Button
            size="icon"
            className="rounded-full shrink-0"
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {/* Hidden LiveKit (keeps session alive) */}
        <LiveKitVoiceCall
          conversationId={conversationId}
          personaName={persona?.name}
          startCallRef={startCallRef}
          onConnectingChange={setCallConnecting}
          onActiveChange={handleActiveChange}
          onTranscriptsUpdated={refetch}
          onCallEnded={handleVoiceCallEnd}
          onMoodIndex={(i) => { moodIndexRef.current = i; }}
        />
      </div>
    );
  }

  // ── Voice mode UI (default) ───────────────────────────────────────────────
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
        {persona?.description && (
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed line-clamp-3">
            {persona.description}
          </p>
        )}

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

        <button
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setTextMode(true)}
        >
          <Keyboard className="w-4 h-4" />
          Prefer to type instead?
        </button>

        <p className="text-xs text-muted-foreground">Tap to start conversation</p>

        {hasMessages && (
          <p className="text-xs text-muted-foreground">
            This session already has {conversation.messages.length} saved messages.
          </p>
        )}
      </div>

      <LiveKitVoiceCall
        conversationId={conversationId}
        personaName={persona?.name}
        startCallRef={startCallRef}
        onConnectingChange={setCallConnecting}
        onActiveChange={handleActiveChange}
        onTranscriptsUpdated={refetch}
        onCallEnded={handleVoiceCallEnd}
        onSwitchToType={() => setTextMode(true)}
        onMoodIndex={(i) => { moodIndexRef.current = i; }}
      />
    </div>
  );
}
