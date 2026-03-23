import { Navigation, MobileHeader, MobileNav } from "@/components/Navigation";
import { useUserStats } from "@/hooks/use-conversations";
import { Loader2, BarChart2, MessageCircle, Users, TrendingUp, Heart } from "lucide-react";

function StatCard({ label, value, icon: Icon, color }: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4 shadow-sm">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-green-500" : score >= 60 ? "bg-blue-500" : score >= 40 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-semibold w-10 text-right text-foreground">{score}</span>
    </div>
  );
}

export default function MyStats() {
  const { data: stats, isLoading } = useUserStats();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 pb-20 md:pb-0">
      <Navigation />
      <MobileHeader />

      <main className="md:pl-64">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 animate-in space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BarChart2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">My Stats</h1>
              <p className="text-sm text-muted-foreground">Your practice progress at a glance</p>
            </div>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Sessions" value={stats?.totalConversations ?? 0} icon={MessageCircle} color="bg-blue-100 text-blue-600" />
            <StatCard label="Personas Practiced" value={stats?.personasPracticed ?? 0} icon={Users} color="bg-purple-100 text-purple-600" />
            <StatCard label="Pass Rate" value={`${stats?.passRate ?? 0}%`} icon={TrendingUp} color="bg-green-100 text-green-600" />
            <StatCard label="Conversions" value={stats?.conversionsAchieved ?? 0} icon={Heart} color="bg-rose-100 text-rose-600" />
          </div>

          {/* Best scores per persona */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">Best Scores by Persona</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Score 60+ to pass a persona</p>
            </div>

            {!stats?.bestScores?.length ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No sessions with feedback yet. Complete a conversation and click "End & Get Feedback" to see your scores here.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {stats.bestScores
                  .sort((a, b) => b.bestScore - a.bestScore)
                  .map((row) => (
                    <div key={row.personaId} className="p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                        {row.personaName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-foreground truncate">{row.personaName}</span>
                          {row.passed && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">
                              ✓ Passed
                            </span>
                          )}
                        </div>
                        <ScoreBar score={row.bestScore} />
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">
                        {row.attempts} {row.attempts === 1 ? "try" : "tries"}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
