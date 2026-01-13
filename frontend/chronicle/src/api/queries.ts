import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import type { 
  WoWLogGroup as WoWLogGroupGenerated, 
  WoWLogFile as WoWLogFileGenerated,
  WoWLogGroupState as WoWLogGroupStateGenerated,
  JobStatus as JobStatusGenerated,
  RiverJobState as RiverJobStateGenerated,
  RiverAttemptError as RiverAttemptErrorGenerated,
} from "./typesGenerated";

// Re-export types for convenience
export type WoWLogGroup = WoWLogGroupGenerated;
export type WoWLogFile = WoWLogFileGenerated;
export type WoWLogGroupState = WoWLogGroupStateGenerated;
export type JobStatus = JobStatusGenerated;
export type RiverJobState = RiverJobStateGenerated;
export type RiverAttemptError = RiverAttemptErrorGenerated;

export function useWhoami(options?: Omit<UseQueryOptions<boolean>, "queryKey" | "queryFn">) {
  return useQuery({
    queryKey: ["whoami"],
    queryFn: async () => {
      const response = await fetch("/api/v1/whoami");
      return response.ok;
    },
    retry: false,
    ...options,
  });
}

export function useAuthProviders(options?: Omit<UseQueryOptions<string[]>, "queryKey" | "queryFn">) {
  return useQuery({
    queryKey: ["authProviders"],
    queryFn: async () => {
      const response = await fetch("/auth/list");
      if (!response.ok) throw new Error("Failed to fetch providers");
      return response.json() as Promise<string[]>;
    },
    ...options,
  });
}

export function useLogGroups(options?: Omit<UseQueryOptions<WoWLogGroup[]>, "queryKey" | "queryFn">) {
  return useQuery({
    queryKey: ["logGroups"],
    queryFn: async () => {
      const response = await fetch("/api/v1/raidlogs/");
      if (!response.ok) throw new Error("Failed to fetch logs");
      return response.json() as Promise<WoWLogGroup[]>;
    },
    ...options,
  });
}

export function useLogGroup(logId: string, options?: Omit<UseQueryOptions<WoWLogGroupState>, "queryKey" | "queryFn">) {
  return useQuery({
    queryKey: ["logGroup", logId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/raidlogs/${logId}`);
      if (!response.ok) throw new Error("Failed to fetch log details");
      return response.json() as Promise<WoWLogGroupState>;
    },
    ...options,
  });
}

export function useDeleteLogGroup() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (logId: string) => {
      const response = await fetch(`/api/v1/raidlogs/${logId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Failed to delete log" }));
        throw new Error(error.message || "Failed to delete log");
      }
      return logId;
    },
    onSuccess: (logId) => {
      // Invalidate and refetch log groups list
      queryClient.invalidateQueries({ queryKey: ["logGroups"] });
      // Remove the specific log from cache
      queryClient.removeQueries({ queryKey: ["logGroup", logId] });
    },
  });
}