import { useAuth } from "@/hooks/use-auth";
import { usePersonas } from "@/hooks/use-personas";
import { useConversations, useCreateConversation, useUserProgress } from "@/hooks/use-conversations";
import { Navigation, MobileHeader, MobileNav } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Phone, Trophy, Lock, Star, Clock, Trash2, ChevronRight, BarChart2, MessageSquare, CheckCircle2, PlayCircle } from "lucide-react";
import { useLocation, Link } from "wouter";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Persona } from "@shared/models/persona";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: personas, isLoading: personasLoading } = usePersonas();
  const { data: conversations, isLoading: conversationsLoading } = useConversations();
  const { data: progress } = useUserProgress();
  const createConversation = useCreateConversation();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const progressMap = Object.fromEntries((progress ?? []).map(p => [p.personaId, p]));

  const levelPassed = (level: number) =>
    (personas ?? []).some(p => (p.difficulty ?? 3) === level && progressMap[p.id]?.passed);

  const levelAttempts = (level: number) => {
    const personasAtLevel = (personas ?? []).filter(p => (p.difficulty ?? 3) === level);
    return personasAtLevel.reduce((sum, p) => sum + (progressMap[p.id]?.attempts ?? 0), 0);
  };

  const unlockedLevel = (() => {
    for (let lvl = 5; lvl >= 1; lvl--) {
      if (levelPassed(lvl)) return Math.min(5, lvl + 1);
    }
    return 1;
  })();

  const deleteConversation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/conversations"] }),
    onError: () => toast({ title: "Could not delete conversation", variant: "destructive" }),
  });

  const handleStartPracticing = () => {
    setLocation("/personas");
  };

  if (!user) return null;

  const recentConversations = (conversations ?? []).slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Navigation />
      <MobileHeader />

      <main className="md:pl-64">
        <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5 animate-in">

          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Welcome back. Ready to continue your journey?</p>
            <div className="flex gap-2 mt-3">
              <Link href="/my-stats">
                <Button variant="outline" size="sm" className="gap-2 rounded-full">
                  <MessageSquare className="w-4 h-4" />
                  Send Feedback
                </Button>
              </Link>
              <Link href="/my-stats">
                <Button variant="outline" size="sm" className="gap-2 rounded-full">
                  <BarChart2 className="w-4 h-4" />
                  My Stats
                </Button>
              </Link>
            </div>
          </div>

          {/* Start a Practice Session */}
          <div className="bg-blue-50 rounded-2xl border border-blue-100 p-5 shadow-sm">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-teal-600 flex items-center justify-center shrink-0">
                <Phone className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-foreground">Start a Practice Session</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Have a natural voice conversation - just like talking to a real person.
                </p>
              </div>
            </div>
            <div className="flex justify-center">
              <Button
                className="gap-2 bg-teal-600 hover:bg-teal-700 text-white px-8 rounded-full"
                onClick={handleStartPracticing}
                disabled={createConversation.isPending || personasLoading || !personas?.length}
              >
                <Phone className="w-4 h-4" />
                Start Practicing
              </Button>
            </div>
          </div>

          {/* Level Progress */}
          {!personasLoading && personas && personas.length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h2 className="font-bold text-foreground">Level Progress</h2>
                </div>
                <Link href="/personas">
                  <Button variant="outline" size="sm" className="rounded-full text-xs">
                    View All Levels
                  </Button>
                </Link>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((lvl) => {
                  const passed = levelPassed(lvl);
                  const unlocked = lvl <= unlockedLevel;
                  const isCurrent = lvl === unlockedLevel && !passed;
                  const attempts = levelAttempts(lvl);

                  return (
                    <div
                      key={lvl}
                      className={cn(
                        "flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-xs font-medium transition-all",
                        passed ? "bg-green-100 text-green-700" :
                        isCurrent ? "bg-primary/10 text-primary border-2 border-primary" :
                        unlocked ? "bg-muted text-muted-foreground" :
                        "bg-muted/50 text-muted-foreground/40"
                      )}
                    >
                      {passed ? (
                        <>
                          <Star className="w-4 h-4 fill-current" />
                          <span>({attempts})</span>
                        </>
                      ) : !unlocked ? (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>L{lvl}</span>
                        </>
                      ) : (
                        <>
                          <span className="font-bold">Lv {lvl}</span>
                          {attempts > 0 && <span className="text-[10px]">{attempts} tries</span>}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Conversations */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b border-border">
              <h2 className="font-bold text-foreground">Recent Conversations</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {conversations?.length ?? 0} Sessions
                </span>
                {(conversations?.length ?? 0) > 0 && (
                  <Link href="/history" className="text-xs font-semibold text-primary hover:underline">
                    View all
                  </Link>
                )}
              </div>
            </div>

            {conversationsLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-muted/50 animate-pulse" />)}
              </div>
            ) : recentConversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No practice sessions yet. Start one above!
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentConversations.map((conv) => {
                  const isCompleted = (conv as any).hasFeedback || conv.converted;
                  const isInProgress = !isCompleted && conv.messageCount > 0;
                  return (
                    <div key={conv.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-sm shrink-0">
                        {conv.personaName?.[0] ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{conv.personaName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3 shrink-0" />
                            {format(new Date(conv.createdAt), "MMM d, yyyy · h:mm a")}
                          </p>
                          {isInProgress && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
                              <PlayCircle className="w-2.5 h-2.5" />
                              In Progress
                            </span>
                          )}
                          {conv.converted && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-1.5 py-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Prayer Moment
                            </span>
                          )}
                          {!conv.converted && (conv as any).hasFeedback && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 rounded-full px-1.5 py-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Completed
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                          onClick={() => {
                            if (confirm("Delete this conversation?")) deleteConversation.mutate(conv.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {isInProgress ? (
                          <Link href={`/chat/${conv.id}`}>
                            <button className="p-1.5 text-amber-500 hover:text-amber-600 transition-colors" title="Continue">
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </Link>
                        ) : isCompleted ? (
                          <Link href={`/feedback/${conv.id}`}>
                            <button className="p-1.5 text-muted-foreground hover:text-primary transition-colors" title="View feedback">
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </main>
      <MobileNav />
    </div>
  );
}
