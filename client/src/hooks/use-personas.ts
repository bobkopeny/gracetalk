import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertPersona, type Persona } from "@shared/models/persona";

export function usePersonas() {
  return useQuery({
    queryKey: [api.personas.list.path],
    queryFn: async () => {
      const res = await fetch(api.personas.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch personas");
      return api.personas.list.responses[200].parse(await res.json());
    },
  });
}

export function usePersona(id: number) {
  return useQuery({
    queryKey: [api.personas.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.personas.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch persona");
      return api.personas.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreatePersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertPersona) => {
      const validated = api.personas.create.input.parse(data);
      const res = await fetch(api.personas.create.path, {
        method: api.personas.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create persona");
      return api.personas.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.personas.list.path] });
    },
  });
}

export function useUpdatePersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, gender, voice }: { id: number; gender?: "female" | "male"; voice?: string }) => {
      const url = buildUrl(api.personas.update.path, { id });
      const res = await fetch(url, {
        method: api.personas.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gender, voice }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update persona");
      return api.personas.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.personas.list.path] });
    },
  });
}

export function useDeletePersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.personas.delete.path, { id });
      const res = await fetch(url, {
        method: api.personas.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete persona");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.personas.list.path] });
    },
  });
}
