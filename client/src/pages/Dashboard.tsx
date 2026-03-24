import { useAuth } from "@/hooks/use-auth";
import { usePersonas } from "@/hooks/use-personas";
import { useConversations, useCreateConversation, useUserProgress } from "@/hooks/use-conversations";
import { Navigation, MobileHeader, MobileNav } from "@/components/Navigation";
import { PersonaCard } from "@/components/PersonaCard";
import { CreatePersonaDialog } from "@/components/CreatePersonaDialog";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus, Clock, ArrowRight, Lock, CheckCircle2, Play } from "lucide-react";
import { useLocation, Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { Persona } from "@shared/models/persona";

const LEVEL_NAMES: Record<number, string> = {
  1: "Open Heart",
  2: "Spiritual Seeker",
  3: "The Professional",
  4: "Hurt & Guarded",
  5: "Skeptical Atheist",
};

function LevelProgressBar({ personas, progress }: {
  personas: Persona[];
  progress: Array<{ personaId: number; passed: boolean; bestScore: number; attempts: number }>;
}) {
  const progressMap = Object.fromEntries(progress.map(p => [p.personaId, p]));

  // For each level 1-5, check if any persona at that difficulty has been passed
  const levelPassed = (level: number) =>
    personas.some(p => (p.difficulty ?? 3) === level && progressMap[p.id]?.passed);

  const unlockedLevel = (() => {
    for (let lvl = 5; lvl >= 1; lvl--) {
      if (levelPassed(lvl)) return Math.min(5, lvl + 1);
    }
    return 1;
  })();

  return (
    <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wide">Your Progress</h2>
      <div className="flex items-center gap-1 sm:gap-2">
        {[1, 2, 3, 4, 5].map((lvl, i) => {
          const passed = levelPassed(lvl);
          const unlocked = lvl <= unlockedLevel;
          const isCurrent = lvl === unlockedLevel && !passed;
          return (
            <div key={lvl} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all",
                  passed ? "bg-green-500 border-green-500 text-white" :
                  isCurrent ? "bg-primary/10 border-primary text-primary animate-pulse" :
                  unlocked ? "bg-blue-50 border-blue-300 text-blue-600" :
                  "bg-muted border-muted-foreground/20 text-muted-foreground/40"
                )}>
                  {passed ? <CheckCircle2 className="w-4 h-4" /> :
                   !unlocked ? <Lock className="w-3.5 h-3.5" /> :
                   <span className="text-xs font-bold">{lvl}</span>}
                </div>
                <span className={cn(
                  "text-[9px] font-medium mt-1 text-center leading-tight hidden sm:block",
                  passed ? "text-green-600" : unlocked ? "text-foreground" : "text-muted-foreground/40"
                )}>
                  {LEVEL_NAMES[lvl]}
                </span>
              </div>
              {i < 4 && (
                <div className={cn(
                  "h-0.5 flex-1 mx-1 rounded",
                  lvl < unlockedLevel ? "bg-green-400" : "bg-muted-foreground/20"
                )} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: personas, isLoading: personasLoading } = usePersonas();
  const { data: conversations, isLoading: conversationsLoading } = useConversations();
  const { data: progress } = useUserProgress();
  const createConversation = useCreateConversation();
  const [, setLocation] = useLocation();

  // Build progress lookup and compute which level is unlocked
  const progressMap = Object.fromEntries((progress ?? []).map(p => [p.personaId, p]));

  const levelPassed = (level: number) =>
    (personas ?? []).some(p => (p.difficulty ?? 3) === level && progressMap[p.id]?.passed);

  const unlockedLevel = (() => {
    for (let lvl = 5; lvl >= 1; lvl--) {
      if (levelPassed(lvl)) return Math.min(5, lvl + 1);
    }
    return 1;
  })();

  const isPersonaUnlocked = (p: Persona) => (p.difficulty ?? 3) <= unlockedLevel;

  const handleStartChat = (personaId: number) => {
    createConversation.mutate(personaId, {
      onSuccess: (data) => setLocation(`/chat/${data.id}`),
    });
  };

  // Deduplicate conversations by personaId — keep most recent (already sorted desc)
  const dedupedConversations = (conversations ?? []).reduce<typeof conversations>((acc, conv) => {
    if (!acc!.find(c => c.personaId === conv.personaId)) acc!.push(conv);
    return acc;
  }, []);

  if (!user) return null;

  // Sort personas by difficulty (level order), then custom ones after
  const sortedPersonas = [...(personas ?? [])].sort((a, b) => (a.difficulty ?? 3) - (b.difficulty ?? 3));

  return (
    <div className="min-h-screen bg-muted/20 pb-20 md:pb-0">
      <Navigation />
      <MobileHeader />

      <main className="md:pl-64 transition-all duration-300">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-in">

          {/* Welcome */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">
                Welcome back, {user.firstName || "Friend"}
              </h1>
              <p className="text-muted-foreground mt-1">Ready to share the good news today?</p>
            </div>
            <CreatePersonaDialog />
          </div>

          {/* Level Progress */}
          {!personasLoading && personas && personas.length > 0 && (
            <LevelProgressBar personas={personas} progress={progress ?? []} />
          )}

          {/* Persona levels */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <MessageSquarePlus className="w-5 h-5 text-primary" />
                Practice Levels
              </h2>
            </div>

            {personasLoading ? (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-48 w-64 shrink-0 rounded-xl bg-muted/50 animate-pulse" />
                ))}
              </div>
            ) : sortedPersonas.length === 0 ? (
              <div className="bg-card rounded-xl p-8 text-center border border-dashed border-border">
                <p className="text-muted-foreground mb-4">You haven't created any personas yet.</p>
                <CreatePersonaDialog />
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 snap-x snap-mandatory">
                {sortedPersonas.map((persona) => {
                  const unlocked = isPersonaUnlocked(persona);
                  return (
                    <div key={persona.id} className="shrink-0 w-72 snap-start">
                      <PersonaCard
                        persona={persona}
                        onStartChat={handleStartChat}
                        progress={progressMap[persona.id]}
                        locked={!unlocked}
                        unlocksAtLevel={unlocked ? undefined : (persona.difficulty ?? 3)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Recent History — one entry per persona */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Recent Sessions
              </h2>
              <Link href="/history">
                <Button variant="link" className="text-primary p-0">View All <ArrowRight className="w-4 h-4 ml-1" /></Button>
              </Link>
            </div>

            {conversationsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse" />)}
              </div>
            ) : dedupedConversations?.length === 0 ? (
              <div className="text-sm text-muted-foreground">No practice sessions yet.</div>
            ) : (
              <div className="bg-card rounded-xl border border-border divide-y divide-border shadow-sm">
                {dedupedConversations?.slice(0, 5).map((conv) => {
                  const hasFeedback = false; // unknown at this level; Resume is always useful
                  return (
                    <div key={conv.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {conv.personaName?.[0] || "?"}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{conv.personaName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(conv.createdAt), { addSuffix: true })}
                            {conv.messageCount > 0 && ` · ${conv.messageCount} messages`}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/chat/${conv.id}`}>
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <Play className="w-3 h-3" />
                            Resume
                          </Button>
                        </Link>
                        <Link href={`/feedback/${conv.id}`}>
                          <Button variant="ghost" size="sm">Feedback</Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
