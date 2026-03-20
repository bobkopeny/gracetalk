import { useParams, Link } from "wouter";
import { useFeedback } from "@/hooks/use-conversations";
import { useConversation } from "@/hooks/use-conversations";
import { Navigation, MobileHeader, MobileNav } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, RefreshCw, Quote, Lightbulb, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";

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

  return (
    <div className="min-h-screen bg-muted/20 pb-20 md:pb-0">
      <Navigation />
      <MobileHeader />

      <main className="md:pl-64">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 animate-in space-y-8">
          
          <div className="flex items-center gap-4 mb-6">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
            </Link>
            <h1 className="text-2xl font-display font-bold">Coaching Feedback</h1>
          </div>

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
                  <h3>Improvements</h3>
                </div>
                <div className="bg-orange-50/50 dark:bg-orange-900/10 p-4 rounded-xl border border-orange-100 dark:border-orange-900/30">
                  <div className="prose prose-sm prose-orange max-w-none">
                     <ReactMarkdown>{feedback.improvements}</ReactMarkdown>
                  </div>
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

          <div className="flex justify-center pt-8">
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
