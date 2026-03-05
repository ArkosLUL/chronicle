import { useWhoami } from "@/api/queries";
import { clearInstanceDefaultsCache } from "@/hooks/useInstanceDefaultsCache";
import { useQueryClient } from "@tanstack/react-query";

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: isAuthenticated, isLoading } = useWhoami();

  const logout = async () => {
    await fetch("/auth/logout");
    clearInstanceDefaultsCache();
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

