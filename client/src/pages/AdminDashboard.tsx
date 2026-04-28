import { Navigation, MobileHeader, MobileNav } from "@/components/Navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Loader2, Shield, Users, MessageCircle, Trash2, RefreshCw, Heart, Activity, Plus, Pencil, ChevronDown, ChevronUp, MessageSquare
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { XAI_VOICES } from "@shared/models/persona";
import { cn } from "@/lib/utils";

function useAdminStats() {
  return useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (res.status === 403) throw new Error("forbidden");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`${res.status}: ${body?.message ?? res.statusText}`);
      }
      return res.json() as Promise<{
        totalUsers: number;
        totalConversations: number;
        prayerMoments: number;
        recentConversations: Array<{
          id: number;
          title: string;
          personaName: string;
          userId: string;
          createdAt: string;
          converted: boolean;
          lastMessage: string | null;
        }>;
        personaStats: Array<{
          personaName: string;
          difficulty: number | null;
          totalSessions: number;
          prayerMoments: number;
        }>;
        conversationPeriods: { lastDay: number; lastWeek: number; lastMonth: number; lastYear: number; total: number };
        userPeriods: { lastDay: number; lastWeek: number; lastMonth: number; lastYear: number; total: number };
      }>;
    },
    refetchInterval: 30000,
  });
}

function useAdminUsers() {
  return useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json() as Promise<Array<{
        id: string;
        email: string | null;
        firstName: string | null;
        lastName: string | null;
        createdAt: string;
      }>>;
    },
    refetchInterval: 30000,
  });
}

interface AdminPersona {
  id: number;
  name: string;
  description: string;
  userId: string;
  difficulty: number;
  voice: string;
  gender: string;
  createdAt: string;
}

function useAdminPersonas() {
  return useQuery({
    queryKey: ["/api/admin/personas"],
    queryFn: async () => {
      const res = await fetch("/api/admin/personas", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch personas");
      return res.json() as Promise<AdminPersona[]>;
    },
    refetchInterval: 30000,
  });
}

function useAdminTestimonials() {
  return useQuery({
    queryKey: ["/api/admin/testimonials"],
    queryFn: async () => {
      const res = await fetch("/api/admin/testimonials", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch testimonials");
      return res.json() as Promise<Array<{
        id: number;
        displayName: string;
        email: string | null;
        content: string;
        createdAt: string;
      }>>;
    },
    refetchInterval: 30000,
  });
}

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: number; sub: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{sub}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

const DIFFICULTY_LABEL: Record<number, string> = {
  1: "Level 1 – Open",
  2: "Level 2 – Agnostic",
  3: "Level 3 – Professional",
  4: "Level 4 – Hurt",
  5: "Level 5 – Skeptic",
};

function PersonaFormDialog({
  open,
  onClose,
  initial,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  initial?: { name: string; description: string; difficulty: number; voice: string; gender: string };
  onSave: (data: { name: string; description: string; difficulty: number; voice: string; gender: string }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? 3);
  const [voice, setVoice] = useState(initial?.voice ?? "Aria");
  const [gender, setGender] = useState(initial?.gender ?? "female");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Persona" : "Add Default Persona"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Name</label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. The Skeptic"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Difficulty (1–5)</label>
            <div className="flex gap-2">
              {[1,2,3,4,5].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    "flex-1 py-2 rounded-lg border text-sm font-medium transition-colors",
                    difficulty === d ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Voice</label>
            <div className="grid grid-cols-5 gap-1.5">
              {XAI_VOICES.map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { setVoice(v.id); setGender(v.gender); }}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-lg border py-2 px-1 text-xs font-medium transition-colors",
                    voice === v.id
                      ? v.gender === "female" ? "border-pink-400 bg-pink-50 text-pink-600" : "border-blue-400 bg-blue-50 text-blue-600"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  )}
                >
                  <span className="text-sm leading-none">{v.gender === "female" ? "♀" : "♂"}</span>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Description / Prompt</label>
            <textarea
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[160px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe their worldview, resistance points, and personality..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onSave({ name, description, difficulty, voice, gender })}
            disabled={saving || !name.trim() || !description.trim()}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {initial ? "Save Changes" : "Create Persona"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const { data: stats, isLoading, error } = useAdminStats();
  const { data: users } = useAdminUsers();
  const { data: personas } = useAdminPersonas();
  const { data: testimonials } = useAdminTestimonials();

  const [refreshing, setRefreshing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editPersona, setEditPersona] = useState<AdminPersona | null>(null);
  const [expandedPrompts, setExpandedPrompts] = useState<Set<number>>(new Set());

  const clearAllConversations = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/conversations/all", { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to clear conversations");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
  });

  const deletePersona = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/personas/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete persona");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/personas"] }),
  });

  const createPersona = useMutation({
    mutationFn: async (data: { name: string; description: string; difficulty: number; voice: string; gender: string }) => {
      const res = await fetch("/api/admin/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create persona");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/personas"] });
      setAddOpen(false);
    },
  });

  const updatePersona = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/admin/personas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update persona");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/personas"] });
      setEditPersona(null);
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ["/api/admin/stats"] }),
      queryClient.refetchQueries({ queryKey: ["/api/admin/users"] }),
      queryClient.refetchQueries({ queryKey: ["/api/admin/testimonials"] }),
      queryClient.refetchQueries({ queryKey: ["/api/admin/personas"] }),
    ]);
    setRefreshing(false);
  };

  const togglePrompt = (id: number) => {
    setExpandedPrompts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center">
        <div className="text-center space-y-2">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-bold">
            {error.message === "forbidden" ? "Access Denied" : "Dashboard Error"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {error.message === "forbidden"
              ? "You don't have admin access."
              : error.message}
          </p>
        </div>
      </div>
    );
  }

  const personaStatMap = new Map<string, { difficulty: number | null; totalSessions: number; prayerMoments: number }>();
  for (const ps of stats?.personaStats ?? []) {
    const existing = personaStatMap.get(ps.personaName);
    if (existing) {
      existing.totalSessions += ps.totalSessions;
      existing.prayerMoments += ps.prayerMoments;
    } else {
      personaStatMap.set(ps.personaName, { difficulty: ps.difficulty, totalSessions: ps.totalSessions, prayerMoments: ps.prayerMoments });
    }
  }
  const dedupedPersonaStats = Array.from(personaStatMap.entries())
    .map(([name, s]) => ({ personaName: name, ...s }))
    .sort((a, b) => (a.difficulty ?? 0) - (b.difficulty ?? 0));

  return (
    <div className="min-h-screen bg-muted/20 pb-20 md:pb-0">
      <Navigation />
      <MobileHeader />

      <main className="md:pl-64">
        <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 animate-in space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Activity className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold">Engagement Dashboard</h1>
                <p className="text-sm text-muted-foreground">Live usage across all users</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          {/* Stat tiles */}
          <div className="space-y-3">
            <StatCard label="Total Users" value={stats?.totalUsers ?? 0} sub="Registered accounts" icon={Users} color="bg-blue-100 text-blue-600" />
            <StatCard label="Total Conversations" value={stats?.totalConversations ?? 0} sub="Practice sessions globally" icon={MessageCircle} color="bg-green-100 text-green-600" />
            <StatCard label="Prayer Moments" value={stats?.prayerMoments ?? 0} sub="Total prayers globally" icon={Heart} color="bg-rose-100 text-rose-500" />
          </div>

          {/* Period breakdown */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-semibold">Activity by Period</h2>
              <p className="text-xs text-muted-foreground mt-0.5">New users and conversations over time</p>
            </div>
            <div className="divide-y divide-border">
              {[
                { label: "Last 24 Hours", users: stats?.userPeriods?.lastDay ?? 0, convs: stats?.conversationPeriods?.lastDay ?? 0 },
                { label: "Last 7 Days",   users: stats?.userPeriods?.lastWeek ?? 0, convs: stats?.conversationPeriods?.lastWeek ?? 0 },
                { label: "Last 30 Days",  users: stats?.userPeriods?.lastMonth ?? 0, convs: stats?.conversationPeriods?.lastMonth ?? 0 },
                { label: "Last Year",     users: stats?.userPeriods?.lastYear ?? 0, convs: stats?.conversationPeriods?.lastYear ?? 0 },
                { label: "All Time",      users: stats?.userPeriods?.total ?? 0, convs: stats?.conversationPeriods?.total ?? 0 },
              ].map(({ label, users, convs }) => (
                <div key={label} className="px-5 py-3 flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-foreground w-32 shrink-0">{label}</p>
                  <div className="flex gap-6 text-right">
                    <div>
                      <p className="text-lg font-bold text-blue-600">{users}</p>
                      <p className="text-[10px] text-muted-foreground">users</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-green-600">{convs}</p>
                      <p className="text-[10px] text-muted-foreground">conversations</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* New Accounts table */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-semibold">New Accounts</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Registered users by time window</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-5 py-2 text-left text-xs text-muted-foreground font-medium">Period</th>
                    <th className="px-5 py-2 text-right text-xs text-muted-foreground font-medium">New Users</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { label: "Last 24 Hours", value: stats?.userPeriods?.lastDay ?? 0 },
                    { label: "Last 7 Days",   value: stats?.userPeriods?.lastWeek ?? 0 },
                    { label: "Last 30 Days",  value: stats?.userPeriods?.lastMonth ?? 0 },
                    { label: "Last Year",     value: stats?.userPeriods?.lastYear ?? 0 },
                    { label: "All Time",      value: stats?.userPeriods?.total ?? 0 },
                  ].map(({ label, value }) => (
                    <tr key={label} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 font-medium text-foreground">{label}</td>
                      <td className="px-5 py-3 text-right font-bold text-blue-600">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-level stats */}
          {dedupedPersonaStats.length > 0 && (
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="p-5 border-b border-border">
                <h2 className="font-semibold">Success by Level</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Sessions and prayer moments per persona</p>
              </div>
              <div className="divide-y divide-border">
                {dedupedPersonaStats.map((ps) => {
                  const pct = ps.totalSessions > 0 ? Math.round((ps.prayerMoments / ps.totalSessions) * 100) : 0;
                  return (
                    <div key={ps.personaName} className="p-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{ps.personaName}</p>
                        <p className="text-xs text-muted-foreground">
                          {ps.difficulty ? DIFFICULTY_LABEL[ps.difficulty] ?? `Level ${ps.difficulty}` : "Custom"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{ps.totalSessions} sessions</p>
                        <p className="text-xs text-rose-500">{ps.prayerMoments} prayers · {pct}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold">Recent Activity</h2>
              {(stats?.recentConversations?.length ?? 0) > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                  onClick={() => {
                    if (confirm("Clear all conversations and activity? This cannot be undone.")) {
                      clearAllConversations.mutate();
                    }
                  }}
                  disabled={clearAllConversations.isPending}
                >
                  {clearAllConversations.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Trash2 className="w-3 h-3 mr-1" />}
                  Clear All
                </Button>
              )}
            </div>
            {!stats?.recentConversations?.length ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No activity yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {stats.recentConversations.map((conv) => (
                  <div key={conv.id} className="p-4 flex items-start gap-3">
                    <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${conv.converted ? "bg-rose-100 text-rose-500" : "bg-primary/10 text-primary"}`}>
                      {conv.converted ? <Heart className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {conv.converted ? "Prayer Moment" : "Conversation Started"}
                      </p>
                      <p className="text-xs text-muted-foreground">with {conv.personaName}</p>
                      {conv.converted && conv.lastMessage && (
                        <p className="text-xs text-muted-foreground italic mt-1 truncate">
                          "{conv.lastMessage.slice(0, 60)}{conv.lastMessage.length > 60 ? "..." : ""}"
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(conv.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* User Feedback / Testimonials */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold">User Feedback</h2>
            </div>
            {!testimonials?.length ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No feedback yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {testimonials.map((t) => (
                  <div key={t.id} className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <span className="text-sm font-medium text-foreground">{t.displayName}</span>
                        {t.email && (
                          <span className="text-xs text-muted-foreground ml-2">{t.email}</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {format(new Date(t.createdAt), "MMM d, yyyy")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{t.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Registered Users */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-semibold">Registered Users</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{users?.length ?? 0} accounts</p>
            </div>
            {!users?.length ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No users yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {users.map((user) => {
                  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "No name provided";
                  return (
                    <div key={user.id} className="p-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email ?? "No email"}</p>
                      </div>
                      <p className="text-xs text-muted-foreground shrink-0">
                        {user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Persona Management */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Manage Default Personas</h2>
                <p className="text-xs text-muted-foreground mt-0.5">These personas are shared with all users. Changes apply globally.</p>
              </div>
              <Button size="sm" className="gap-2" onClick={() => setAddOpen(true)}>
                <Plus className="w-4 h-4" />
                Add Persona
              </Button>
            </div>
            {!personas?.length ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No personas.</div>
            ) : (
              <div className="divide-y divide-border">
                {personas.map((persona) => (
                  <div key={persona.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-foreground">{persona.name}</p>
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            Lv {persona.difficulty}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{persona.description}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setEditPersona(persona)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => { if (confirm(`Delete persona "${persona.name}"?`)) deletePersona.mutate(persona.id); }}
                          disabled={deletePersona.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <button
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                      onClick={() => togglePrompt(persona.id)}
                    >
                      {expandedPrompts.has(persona.id) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      View prompt ({persona.description.length} characters)
                    </button>
                    {expandedPrompts.has(persona.id) && (
                      <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                        {persona.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
      <MobileNav />

      {/* Add Persona Dialog */}
      <PersonaFormDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={(data) => createPersona.mutate(data)}
        saving={createPersona.isPending}
      />

      {/* Edit Persona Dialog */}
      {editPersona && (
        <PersonaFormDialog
          open={true}
          onClose={() => setEditPersona(null)}
          initial={editPersona}
          onSave={(data) => updatePersona.mutate({ id: editPersona.id, data })}
          saving={updatePersona.isPending}
        />
      )}
    </div>
  );
}
