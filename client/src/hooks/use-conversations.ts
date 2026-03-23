import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

// List all conversations
export function useConversations() {
  return useQuery({
    queryKey: [api.conversations.list.path],
    queryFn: async () => {
      const res = await fetch(api.conversations.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return api.conversations.list.responses[200].parse(await res.json());
    },
  });
}

// Get single conversation with messages
export function useConversation(id: number) {
  return useQuery({
    queryKey: [api.conversations.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.conversations.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch conversation");
      return api.conversations.get.responses[200].parse(await res.json());
    },
    enabled: !!id && !isNaN(id),
    refetchInterval: 5000, // Poll for updates occasionally
  });
}

// Create new conversation
export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (personaId: number) => {
      const res = await fetch(api.conversations.create.path, {
        method: api.conversations.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to start conversation");
      return api.conversations.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.conversations.list.path] });
    },
  });
}

// Send message
export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: number; content: string }) => {
      const url = buildUrl(api.conversations.messages.create.path, { id: conversationId });
      const res = await fetch(url, {
        method: api.conversations.messages.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to send message");
      return api.conversations.messages.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.conversations.get.path, variables.conversationId] });
    },
  });
}

// Generate Feedback
export function useGenerateFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: number) => {
      const url = buildUrl(api.conversations.feedback.generate.path, { id: conversationId });
      const res = await fetch(url, {
        method: api.conversations.feedback.generate.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to generate feedback");
      return api.conversations.feedback.generate.responses[201].parse(await res.json());
    },
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: [api.conversations.feedback.get.path, conversationId] });
      queryClient.invalidateQueries({ queryKey: [api.conversations.list.path] });
    },
  });
}

// User Progress
export function useUserProgress() {
  return useQuery({
    queryKey: ["/api/user/progress"],
    queryFn: async () => {
      const res = await fetch("/api/user/progress", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch progress");
      return res.json() as Promise<Array<{ id: number; personaId: number; bestScore: number; passed: boolean; attempts: number }>>;
    },
  });
}

// User Stats
export function useUserStats() {
  return useQuery({
    queryKey: ["/api/user/stats"],
    queryFn: async () => {
      const res = await fetch("/api/user/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json() as Promise<{
        totalConversations: number;
        personasPracticed: number;
        passRate: number;
        conversionsAchieved: number;
        bestScores: Array<{ personaId: number; personaName: string; bestScore: number; passed: boolean; attempts: number }>;
      }>;
    },
  });
}

// Get Feedback
export function useFeedback(conversationId: number) {
  return useQuery({
    queryKey: [api.conversations.feedback.get.path, conversationId],
    queryFn: async () => {
      const url = buildUrl(api.conversations.feedback.get.path, { id: conversationId });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch feedback");
      return api.conversations.feedback.get.responses[200].parse(await res.json());
    },
    enabled: !!conversationId,
  });
}
