import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

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