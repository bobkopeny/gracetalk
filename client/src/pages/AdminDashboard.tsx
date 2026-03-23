import { Navigation, MobileHeader, MobileNav } from "@/components/Navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, Users, MessageCircle, Trash2, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function useAdminStats() {
  return useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (res.status === 403) throw new Error("forbidden");
      if (!res.ok) throw new Error("Failed to fetch admin stats");
      return res.json() as Promise<{
        totalUsers: number;
        totalConversations: number;
        recentConversations: Array<{
          id: number; title: string; personaName: string;
          userId: string; createdAt: string; converted: boolean;
        }>;
      }>;
    },
    refetchInterval: 30000,
  });
}

function useAdminPersonas() {
  return useQuery({
    queryKey: ["/api/admin/personas"],
    queryFn: async () => {
      const res = await fetch("/api/admin/personas", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch personas");
      return res.json() as Promise<Array<{
        id: number; name: string; description: string;
        userId: string; difficulty: number; createdAt: string;
      }>>;
    },
  });
}

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const { data: stats, isLoading, error } = useAdminStats();
  const { data: personas } = useAdminPersonas();

  const deletePersona = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/personas/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete persona");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/personas"] });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error?.message === "forbidden") {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center">
        <div className="text-center space-y-2">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground text-sm">You don't have admin access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 pb-20 md:pb-0">
      <Navigation />
      <MobileHeader />

      <main className="md:pl-64">
        <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 animate-in space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold">Admin Dashboard</h1>
                <p className="text-sm text-muted-foreground">Refreshes every 30 seconds</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] })}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalUsers ?? 0}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
            <div className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalConversations ?? 0}</p>
                <p className="text-sm text-muted-foreground">Total Conversations</p>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-semibold">Recent Activity</h2>
            </div>
            {!stats?.recentConversations?.length ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No activity yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {stats.recentConversations.map((conv) => (
                  <div key={conv.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {conv.personaName}
                        {conv.converted && <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">Converted</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        User {conv.userId.substring(0, 8)}… · {formatDistanceToNow(new Date(conv.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Persona Management */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-semibold">All Personas</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{personas?.length ?? 0} total</p>
            </div>
            {!personas?.length ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No personas.</div>
            ) : (
              <div className="divide-y divide-border">
                {personas.map((persona) => (
                  <div key={persona.id} className="p-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-foreground">{persona.name}</p>
                        <span className="text-[10px] text-muted-foreground">difficulty {persona.difficulty}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{persona.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">User {persona.userId.substring(0, 8)}…</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => {
                        if (confirm(`Delete persona "${persona.name}"?`)) {
                          deletePersona.mutate(persona.id);
                        }
                      }}
                      disabled={deletePersona.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
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
