import { useParams, Link } from "wouter";
import { useFeedback } from "@/hooks/use-conversations";
import { useConversation } from "@/hooks/use-conversations";
import { Navigation, MobileHeader, MobileNav } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, RefreshCw, Lightbulb, BookOpen, Star, Heart, Youtube } from "lucide-react";
import ReactMarkdown from "react-markdown";

function ScoreRing({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#16a34a" : score >= 60 ? "#2563eb" : score >= 40 ? "#d97706" : "#dc2626";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="110" height="110" className="-rotate-90">
        <circle cx="55" cy="55" r={radius} stroke="#e5e7eb" strokeWidth="10" fill="none" />
        <circle
          cx="55" cy="55" r={radius}
          stroke={color} strokeWidth="10" fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <span className="text-2xl font-bold text-foreground">{score}</span>
        <span className="block text-[10px] text-muted-foreground leading-none">/ 100</span>
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  const { id } = useParams();
  const conversationId = Number(id);

  const { data: feedback, isLoading: feedbackLoading } = useFeedback(conversationId);
  const { data: conversation } = useConversation(conversationId);

  if (feedbackLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-muted/20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-muted-foreground animate-pulse">Analyzing your conversation...</p>
      </div>
    );
  }

  if (!feedback) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p>Feedback not found.</p>
        <Link href="/dashboard"><Button variant="link">Go Home</Button></Link>
      </div>
    );
  }

  const score: number | null = (feedback as any).score ?? null;
  const converted: boolean = (feedback as any).converted ?? false;
  const scoreBreakdown: string = (feedback as any).scoreBreakdown ?? "";
  const youtubeSearches: Record<string, string> = (feedback as any).youtubeSearches ?? {};
  const ytEntries = Object.entries(youtubeSearches);

  return (
    <div className="min-h-screen bg-muted/20 pb-20 md:pb-0">
      <Navigation />
      <MobileHeader />

      <main className="md:pl-64">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 animate-in space-y-6">

          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
            </Link>
            <h1 className="text-2xl font-display font-bold">Coaching Feedback</h1>
          </div>

          {/* Score + Conversion banner */}
          <div className={`rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6 shadow-sm border ${converted ? "bg-green-50 border-green-200" : "bg-card border-border"}`}>
            {score !== null && <ScoreRing score={score} />}
            <div className="flex-1 text-center sm:text-left">
              {converted ? (
                <>
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                    <Heart className="w-6 h-6 text-green-600 fill-green-600" />
                    <span className="text-xl font-bold text-green-700">Conversion Achieved!</span>
                  </div>
                  <p className="text-green-600 text-sm">The persona prayed the sinner's prayer. Amazing work!</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold text-foreground">
                    {score !== null && score >= 80 ? "Excellent Session" : score !== null && score >= 60 ? "Strong Session" : score !== null && score >= 40 ? "Good Effort" : "Keep Practicing"}
                  </p>
                  <p className="text-sm text-muted-foreground">No conversion this time — keep building that connection</p>
                </>
              )}
              {scoreBreakdown && (
                <p className="text-sm text-muted-foreground mt-2 italic">{scoreBreakdown}</p>
              )}
            </div>
            {score !== null && (
              <div className="flex gap-1">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className={`w-5 h-5 ${i <= Math.round(score / 20) ? "text-amber-400 fill-amber-400" : "text-gray-300"}`} />
                ))}
              </div>
            )}
          </div>

          {/* Overall Analysis */}
          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="bg-primary/5 p-6 border-b border-primary/10">
              <h2 className="text-lg font-semibold text-primary mb-2">Overall Analysis</h2>
              <div className="prose prose-sm prose-slate max-w-none text-muted-foreground">
                <ReactMarkdown>{feedback.generalFeedback}</ReactMarkdown>
              </div>
            </div>

            <div className="p-6 grid gap-8 md:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-semibold">
                  <Lightbulb className="w-5 h-5" />
                  <h3>Strengths</h3>
                </div>
                <div className="bg-green-50/50 dark:bg-green-900/10 p-4 rounded-xl border border-green-100 dark:border-green-900/30">
                  <div className="prose prose-sm prose-green max-w-none">
                    <ReactMarkdown>{feedback.strengths}</ReactMarkdown>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-orange-600 font-semibold">
                  <RefreshCw className="w-5 h-5" />
                  <h3>Ways to Improve</h3>
                </div>
                <div className="bg-orange-50/50 dark:bg-orange-900/10 p-4 rounded-xl border border-orange-100 dark:border-orange-900/30">
                  <div className="prose prose-sm prose-orange max-w-none">
                     <ReactMarkdown>{feedback.improvements}</ReactMarkdown>
                  </div>
                  {ytEntries.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {ytEntries.map(([label, query]) => (
                        <a
                          key={label}
                          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="outline" size="sm" className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 text-xs">
                            <Youtube className="w-3.5 h-3.5" />
                            {label}
                          </Button>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-border bg-slate-50/50 dark:bg-slate-900/20">
              <div className="flex items-center gap-2 text-primary font-semibold mb-4">
                <BookOpen className="w-5 h-5" />
                <h3>Biblical References</h3>
              </div>
              <div className="prose prose-sm max-w-none text-slate-600 dark:text-slate-300 italic">
                <ReactMarkdown>{feedback.biblicalReferences}</ReactMarkdown>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-4">
            <Link href="/dashboard">
              <Button size="lg" className="rounded-full px-8">Start Another Session</Button>
            </Link>
          </div>
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
