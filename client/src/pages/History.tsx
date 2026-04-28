import { useConversations } from "@/hooks/use-conversations";
import { Navigation, MobileHeader, MobileNav } from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, MessageSquare, ArrowRight, BarChart2, CheckCircle2, PlayCircle, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function History() {
  const { data: conversations, isLoading } = useConversations();

  return (
    <div className="min-h-screen bg-muted/20 pb-20 md:pb-0">
      <Navigation />
      <MobileHeader />

      <main className="md:pl-64">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 animate-in">
          <div className="mb-8">
            <h1 className="text-3xl font-display font-bold text-foreground">Practice History</h1>
            <p className="text-muted-foreground mt-1">Resume an in-progress session or review completed ones. To start fresh with any persona, go to <Link href="/personas" className="text-teal-600 underline underline-offset-2">Personas</Link>.</p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {conversations?.map((conv) => {
                const isCompleted = (conv as any).hasFeedback || conv.converted;
                const isInProgress = !isCompleted && conv.messageCount > 0;
                const preview = conv.lastMessage
                  ? conv.lastMessage.length > 120
                    ? conv.lastMessage.slice(0, 120) + "…"
                    : conv.lastMessage
                  : null;

                return (
                  <Card key={conv.id} className={cn("p-5 hover:shadow-md transition-shadow border", isCompleted ? "border-border/40 bg-muted/20" : "border-border/60")}>
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Avatar + info */}
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className={cn("w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0", isCompleted ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>
                          {conv.personaName?.[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-semibold text-foreground">{conv.personaName}</h3>
                            {isInProgress && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                                <PlayCircle className="w-3 h-3" />
                                In Progress
                              </span>
                            )}
                            {conv.converted && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-2 py-0.5">
                                <CheckCircle2 className="w-3 h-3" />
                                Prayer Moment
                              </span>
                            )}
                            {!conv.converted && (conv as any).hasFeedback && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                                <CheckCircle2 className="w-3 h-3" />
                                Completed
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3 shrink-0" />
                            {format(new Date(conv.createdAt), "MMM d, yyyy 'at' h:mm a")}
                            {conv.messageCount > 0 && (
                              <>
                                <span className="mx-1">·</span>
                                <MessageSquare className="w-3 h-3 shrink-0" />
                                {conv.messageCount} {conv.messageCount === 1 ? "message" : "messages"}
                              </>
                            )}
                          </p>
                          {preview && (
                            <p className="mt-2 text-sm text-muted-foreground italic leading-relaxed line-clamp-2">
                              "{preview}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex sm:flex-col gap-2 sm:items-end justify-end shrink-0">
                        {isInProgress ? (
                          <>
                            <Link href={`/chat/${conv.id}`}>
                              <Button className="gap-2 rounded-xl w-full sm:w-auto bg-amber-500 hover:bg-amber-600">
                                Continue
                                <ArrowRight className="w-4 h-4" />
                              </Button>
                            </Link>
                            <Link href="/personas">
                              <Button variant="outline" size="sm" className="gap-1.5 rounded-xl w-full sm:w-auto text-xs">
                                <RefreshCw className="w-3 h-3" />
                                Start Fresh
                              </Button>
                            </Link>
                          </>
                        ) : (
                          <>
                            <Link href={`/feedback/${conv.id}`}>
                              <Button variant="outline" className="gap-2 rounded-xl w-full sm:w-auto">
                                <BarChart2 className="w-4 h-4" />
                                Review
                              </Button>
                            </Link>
                            <Link href="/personas">
                              <Button variant="ghost" size="sm" className="gap-1.5 rounded-xl w-full sm:w-auto text-xs text-teal-600">
                                <RefreshCw className="w-3 h-3" />
                                Try Again
                              </Button>
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {!isLoading && conversations?.length === 0 && (
            <div className="text-center py-20 bg-card rounded-xl border border-dashed border-border">
              <p className="text-muted-foreground mb-4">No practice sessions yet.</p>
              <Link href="/dashboard"><Button>Start Practicing</Button></Link>
            </div>
          )}
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
