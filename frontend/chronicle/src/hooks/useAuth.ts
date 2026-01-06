import { useQuery, useQueryClient } from "@tanstack/react-query";

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: isAuthenticated, isLoading } = useQuery({
    queryKey: ["whoami"],
    queryFn: async () => {
      const response = await fetch("/api/v1/whoami");
      return response.ok;
    },
    retry: false,
  });

  const logout = async () => {
    await fetch("/auth/logout");
    queryClient.invalidateQueries();
    window.location.href = "/";
  };

  return {
    isAuthenticated: isAuthenticated ?? false,
    isLoading,
    logout,
  };
}
