import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, ArrowLeft, Shield, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveKitVoiceCall } from "@/components/LiveKitVoiceCall";

const DEMO_PERSONAS = [
  { id: "open-heart", name: "The Open Heart" },
  { id: "spiritual-agnostic", name: "The Spiritual Agnostic" },
  { id: "professional", name: "The Professional" },
  { id: "hurt-by-church", name: "Hurt by the Church" },
  { id: "skeptical-atheist", name: "The Skeptical Atheist" },
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function GuestChat() {
  const { personaId } = useParams();
  const persona = DEMO_PERSONAS.find((p) => p.id === personaId);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !personaId) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/demo/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId,
          messages: messages,
          content: userMessage.content,
        }),
      });

      if (!res.ok) throw new Error("Failed to get response");
      const data = await res.json();
      setMessages([...nextMessages, { role: "assistant", content: data.content }]);
    } catch {
      setMessages([...nextMessages, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!persona) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Persona not found. <Link href="/" className="text-primary underline">Go back</Link></p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="bg-card border-b border-border p-4 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
            {persona.name[0]}
          </div>
          <div>
            <h2 className="font-bold text-foreground leading-none">{persona.name}</h2>
            <p className="text-xs text-muted-foreground mt-1">Demo Session</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LiveKitVoiceCall personaId={personaId} />
          <Link href="/register">
            <Button size="sm" variant="outline" className="gap-2">
              <UserPlus className="w-4 h-4" />
              Sign Up
            </Button>
          </Link>
        </div>
      </div>

      {/* Sign-up banner */}
      <div className="bg-primary/5 border-b border-primary/10 px-4 py-2 text-center text-sm text-primary shrink-0">
        You're in demo mode — conversations aren't saved.{" "}
        <Link href="/register" className="font-semibold underline">
          Create a free account
        </Link>{" "}
        to track your progress and get AI coaching feedback.
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6" ref={scrollRef}>
        <div className="flex justify-center mb-8">
          <div className="bg-primary/5 text-primary text-sm px-4 py-2 rounded-full border border-primary/10">
            Start the conversation by greeting {persona.name}.
          </div>
        </div>

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex w-full max-w-3xl mx-auto",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-3 shadow-sm text-sm sm:text-base leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-card text-card-foreground rounded-tl-sm border border-border/50"
              )}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start w-full max-w-3xl mx-auto">
            <div className="bg-card px-4 py-3 rounded-2xl rounded-tl-sm border border-border/50 flex items-center gap-2">
              <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        {messages.length >= 6 && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 text-center space-y-3">
              <Shield className="w-8 h-8 text-primary mx-auto" />
              <p className="font-semibold text-foreground">Ready to go deeper?</p>
              <p className="text-sm text-muted-foreground">
                Create a free account to get AI coaching feedback, track your progress, and unlock voice conversations.
              </p>
              <Link href="/register">
                <Button className="rounded-full px-6">Create Free Account</Button>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-card p-4 border-t border-border shrink-0">
        <div className="max-w-3xl mx-auto flex gap-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="min-h-[50px] max-h-[150px] resize-none py-3 px-4 rounded-xl border-border focus:ring-primary/20"
            autoFocus
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="h-auto rounded-xl px-6"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
