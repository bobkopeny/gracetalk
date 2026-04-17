import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigation, MobileHeader, MobileNav } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle, Heart, RefreshCw, BarChart2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

function useMyProgress() {
  return useQuery({
    queryKey: ["/api/user/stats"],
    queryFn: async () => {
      const res = await fetch("/api/user/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json() as Promise<{
        totalConversations: number;
        conversionsAchieved: number;
      }>;
    },
  });
}

function useMyActivity() {
  return useQuery({
    queryKey: ["/api/user/activity"],
    queryFn: async () => {
      const res = await fetch("/api/user/activity", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch activity");
      return res.json() as Promise<Array<{ type: "started" | "prayer"; personaName: string; timestamp: string }>>;
    },
  });
}

export default function MyStats() {
  const { data: stats, isLoading: statsLoading } = useMyProgress();
  const { data: activity, isLoading: activityLoading } = useMyActivity();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isAdmin = !!(process.env.ADMIN_USER_ID) || false;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/user/activity"] });
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: feedbackText.trim() }),
      });
      if (res.ok) {
        setSubmitted(true);
        setFeedbackText("");
        toast({ title: "Feedback submitted", description: "Thank you for sharing!" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = statsLoading || activityLoading;

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
        <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8 animate-in space-y-4">

          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-display font-bold">My Progress</h1>
            <div className="flex items-center gap-2">
              <Link href="/admin">
                <Button variant="outline" size="sm" className="gap-2">
                  <BarChart2 className="w-4 h-4" />
                  Global Stats
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* My Conversations */}
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">My Conversations</p>
                <p className="text-4xl font-bold text-foreground mt-1">{stats?.totalConversations ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Practice sessions you've started</p>
              </div>
              <MessageCircle className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </div>

          {/* Prayer Moments */}
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Prayer Moments</p>
                <p className="text-4xl font-bold text-teal-600 mt-1">{stats?.conversionsAchieved ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Times someone agreed to pray</p>
              </div>
              <Heart className="w-8 h-8 text-rose-300" />
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-semibold">Your Recent Activity</h2>
            </div>
            {!activity?.length ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                No activity yet. Start a practice session!
              </div>
            ) : (
              <div className="divide-y divide-border">
                {activity.map((item, i) => (
                  <div key={i} className="p-4 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${item.type === "prayer" ? "bg-rose-100 text-rose-500" : "bg-primary/10 text-primary"}`}>
                      {item.type === "prayer" ? <Heart className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {item.type === "prayer" ? "Prayer Moment" : "Conversation Started"}
                      </p>
                      <p className="text-xs text-muted-foreground">with {item.personaName}</p>
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Feedback */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-semibold">Share Your Experience</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Your feedback helps improve GraceTalk</p>
            </div>
            <div className="p-4 space-y-3">
              {submitted ? (
                <p className="text-sm text-green-600 text-center py-2">Thank you for your feedback!</p>
              ) : (
                <>
                  <textarea
                    className="w-full rounded-xl border border-border bg-muted/30 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[80px]"
                    placeholder="Tell us about your experience with GraceTalk..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                  />
                  <Button
                    className="w-full"
                    onClick={handleSubmitFeedback}
                    disabled={!feedbackText.trim() || submitting}
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Submit Feedback
                  </Button>
                </>
              )}
            </div>
          </div>

        </div>
      </main>
      <MobileNav />
    </div>
  );
}
