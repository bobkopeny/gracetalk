import { useAuth } from "@/hooks/use-auth";
import { usePersonas } from "@/hooks/use-personas";
import { useConversations, useCreateConversation, useUserProgress } from "@/hooks/use-conversations";
import { Navigation, MobileHeader, MobileNav } from "@/components/Navigation";
import { PersonaCard } from "@/components/PersonaCard";
import { CreatePersonaDialog } from "@/components/CreatePersonaDialog";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus, Clock, ArrowRight } from "lucide-react";
import { useLocation, Link } from "wouter";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: personas, isLoading: personasLoading } = usePersonas();
  const { data: conversations, isLoading: conversationsLoading } = useConversations();
  const { data: progress } = useUserProgress();
  const progressMap = Object.fromEntries((progress ?? []).map(p => [p.personaId, p]));
  const createConversation = useCreateConversation();
  const [, setLocation] = useLocation();

  const handleStartChat = (personaId: number) => {
    createConversation.mutate(personaId, {
      onSuccess: (data) => {
        setLocation(`/chat/${data.id}`);
      },
    });
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-muted/20 pb-20 md:pb-0">
      <Navigation />
      <MobileHeader />

      <main className="md:pl-64 transition-all duration-300">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-in">
          
          {/* Welcome Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">
                Welcome back, {user.firstName || "Friend"}
              </h1>
              <p className="text-muted-foreground mt-1">Ready to share the good news today?</p>
            </div>
            <CreatePersonaDialog />
          </div>

          {/* Quick Start Personas — horizontal scroll */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <MessageSquarePlus className="w-5 h-5 text-primary" />
                Start a New Session
              </h2>
            </div>

            {personasLoading ? (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-48 w-64 shrink-0 rounded-xl bg-muted/50 animate-pulse" />
                ))}
              </div>
            ) : personas?.length === 0 ? (
              <div className="bg-card rounded-xl p-8 text-center border border-dashed border-border">
                <p className="text-muted-foreground mb-4">You haven't created any personas yet.</p>
                <CreatePersonaDialog />
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 snap-x snap-mandatory">
                {personas?.map((persona) => (
                  <div key={persona.id} className="shrink-0 w-72 snap-start">
                    <PersonaCard
                      persona={persona}
                      onStartChat={handleStartChat}
                      progress={progressMap[persona.id]}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent History */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Recent History
              </h2>
              <Link href="/history">
                <Button variant="link" className="text-primary p-0">View All <ArrowRight className="w-4 h-4 ml-1" /></Button>
              </Link>
            </div>

            {conversationsLoading ? (
               <div className="space-y-3">
                 {[1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse" />)}
               </div>
            ) : conversations?.length === 0 ? (
              <div className="text-sm text-muted-foreground">No practice sessions yet.</div>
            ) : (
              <div className="bg-card rounded-xl border border-border divide-y divide-border shadow-sm">
                {conversations?.slice(0, 5).map((conv) => (
                  <div key={conv.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {conv.personaName?.[0] || "?"}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{conv.personaName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(conv.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <Link href={`/feedback/${conv.id}`}>
                      <Button variant="outline" size="sm">View Feedback</Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
