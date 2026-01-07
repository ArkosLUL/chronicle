import { useWhoami } from "@/api/queries";
import { useQueryClient } from "@tanstack/react-query";

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: isAuthenticated, isLoading } = useWhoami();

  const logout = async () => {
    await fetch("/auth/logout");
    window.location.reload();
    // Queries should be invalid from a reload
    queryClient.invalidateQueries();
  };

  return {
    isAuthenticated: isAuthenticated ?? false,
    isLoading,
    logout,
  };
}

