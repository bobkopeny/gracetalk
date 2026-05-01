import { useParams, Link } from "wouter";
import { useConversation } from "@/hooks/use-conversations";
import { usePersona } from "@/hooks/use-personas";
import { Navigation, MobileHeader, MobileNav } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, BarChart2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function TranscriptPage() {
  const { id } = useParams();
  const conversationId = Number(id);

  const { data: conversation, isLoading } = useConversation(conversationId);
  const { data: persona } = usePersona(conversation?.personaId || 0);

  return (
    <div className="min-h-screen bg-muted/20 pb-20 md:pb-0">
      <Navigation />
      <MobileHeader />

      <main className="md:pl-64">
        <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8 animate-in">
          {/* Header */}
          <div className="mb-6 flex items-center gap-3">
            <Link href="/history">
              <Button variant="ghost" size="sm" className="gap-1.5 rounded-xl">
                <ArrowLeft className="w-4 h-4" />
                History
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : !conversation ? (
            <p className="text-muted-foreground text-center py-20">Conversation not found.</p>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-display font-bold text-foreground">
                  {persona?.name ?? "Conversation"}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(new Date(conversation.createdAt), "MMMM d, yyyy 'at' h:mm a")}
                  {conversation.converted && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-2 py-0.5">
                      <CheckCircle2 className="w-3 h-3" />
                      Prayer Moment
                    </span>
                  )}
                </p>
              </div>

              {/* Messages */}
              <div className="space-y-3 mb-8">
                {(conversation as any).messages?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-10">No messages in this conversation.</p>
                ) : (
                  (conversation as any).messages?.map((msg: any) => (
                    <div
                      key={msg.id}
                      className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
                    >
                      {msg.role !== "user" && (
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 mr-2 mt-1">
                          {persona?.name?.[0] ?? "A"}
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-card border border-border text-foreground rounded-bl-sm"
                        )}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer actions */}
              <div className="flex gap-3 justify-center">
                {(conversation as any).hasFeedback && (
                  <Link href={`/feedback/${conversationId}`}>
                    <Button className="gap-2 rounded-xl">
                      <BarChart2 className="w-4 h-4" />
                      View Feedback
                    </Button>
                  </Link>
                )}
                <Link href="/personas">
                  <Button variant="outline" className="rounded-xl">Try Again</Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
