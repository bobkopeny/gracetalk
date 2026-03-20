import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useConversation, useSendMessage, useGenerateFeedback } from "@/hooks/use-conversations";
import { usePersona } from "@/hooks/use-personas";
import { Navigation, MobileHeader } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, CheckCircle2, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { useVoiceRecorder, useVoiceStream } from "../../replit_integrations/audio";
import { LiveKitVoiceCall } from "@/components/LiveKitVoiceCall";

export default function ChatSession() {
  const { id } = useParams();
  const conversationId = Number(id);
  const [, setLocation] = useLocation();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversation, isLoading, refetch } = useConversation(conversationId);
  const { data: persona } = usePersona(conversation?.personaId || 0);
  
  const sendMessage = useSendMessage();
  const generateFeedback = useGenerateFeedback();

  const recorder = useVoiceRecorder();
  const stream = useVoiceStream({
    onUserTranscript: (text) => {
      // User transcript will be added to the messages via refetch when done
    },
    onTranscript: (delta, full) => {
      // Real-time text update if needed
    },
    onComplete: () => {
      refetch();
    },
  });

  const isVoiceActive = recorder.state === "recording" || stream.playbackState === "playing";

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation?.messages, stream.playbackState]);

  const handleSend = () => {
    if (!input.trim() || sendMessage.isPending) return;
    
    sendMessage.mutate(
      { conversationId, content: input },
      {
        onSuccess: () => setInput(""),
      }
    );
  };

  const handleMicClick = async () => {
    if (recorder.state === "recording") {
      const blob = await recorder.stopRecording();
      await stream.streamVoiceResponse(`/api/conversations/${conversationId}/messages`, blob);
    } else {
      await recorder.startRecording();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEndSession = () => {
    generateFeedback.mutate(conversationId, {
      onSuccess: () => {
        setLocation(`/feedback/${conversationId}`);
      },
    });
  };

  if (isLoading || !conversation) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 md:pl-64 flex flex-col h-screen overflow-hidden">
      <Navigation />
      
      {/* Header */}
      <div className="bg-card border-b border-border p-4 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
            {persona?.name?.[0]}
          </div>
          <div>
            <h2 className="font-bold text-foreground leading-none">{persona?.name}</h2>
            <p className="text-xs text-muted-foreground mt-1">Practice Session</p>
          </div>
        </div>
        <LiveKitVoiceCall
          conversationId={conversationId}
          onTranscriptsUpdated={refetch}
          onActiveChange={setVoiceCallActive}
        />
        <Button
          variant="secondary"
          onClick={handleEndSession}
          disabled={generateFeedback.isPending}
          className="gap-2"
        >
          {generateFeedback.isPending ? (
             <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          End & Get Feedback
        </Button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6" ref={scrollRef}>
        {/* Intro Message */}
        <div className="flex justify-center mb-8">
          <div className="bg-primary/5 text-primary text-sm px-4 py-2 rounded-full border border-primary/10">
            Start the conversation by greeting {persona?.name}.
          </div>
        </div>

        {conversation.messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={cn(
                "flex w-full max-w-3xl mx-auto animate-in",
                isUser ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-3 shadow-sm text-sm sm:text-base leading-relaxed",
                  isUser
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-card text-card-foreground rounded-tl-sm border border-border/50"
                )}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          );
        })}
        
        {sendMessage.isPending && (
          <div className="flex justify-start w-full max-w-3xl mx-auto">
            <div className="bg-card px-4 py-3 rounded-2xl rounded-tl-sm border border-border/50 flex items-center gap-2">
              <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
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
            onClick={handleMicClick}
            variant={recorder.state === "recording" ? "destructive" : "outline"}
            className="h-auto rounded-xl px-4"
          >
            {recorder.state === "recording" ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || sendMessage.isPending || isVoiceActive}
            className="h-auto rounded-xl px-6"
          >
            {sendMessage.isPending || isVoiceActive ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
