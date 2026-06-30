import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card/Card";
import { Button } from "@/components/ui/button";
import type { AdminCacheStatsResponse } from "@/api/typesGenerated";

function useAdminCacheStats() {
  return useQuery<AdminCacheStatsResponse>({
    queryKey: ["admin", "cache-stats"],
    queryFn: async () => {
      const response = await fetch("/api/v1/admin/cache-stats");
      if (!response.ok) throw new Error("Failed to fetch cache stats");
      return response.json() as Promise<AdminCacheStatsResponse>;
    },
    refetchInterval: 10_000,
  });
}

function usePurgeCache() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name?: string) => {
      const url = name
        ? `/api/v1/admin/cache-stats/purge/${encodeURIComponent(name)}`
        : "/api/v1/admin/cache-stats/purge";
      const response = await fetch(url, { method: "POST" });
      if (!response.ok) throw new Error("Failed to purge cache");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "cache-stats"] });
    },
  });
}

export function AdminCacheStatsPage() {
  const { data, isLoading } = useAdminCacheStats();
  const purge = usePurgeCache();

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const caches = data?.caches ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Cache Statistics</h2>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => purge.mutate(undefined)}
          disabled={purge.isPending}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Purge All
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Auto-refreshes every 10 seconds. TTL is fixed from last write — reads do not extend it.
      </p>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium text-right">Entries</th>
              <th className="px-4 py-3 font-medium text-right">Capacity</th>
              <th className="px-4 py-3 font-medium text-right">Fill %</th>
              <th className="px-4 py-3 font-medium text-right">TTL</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {caches.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  No caches registered.
                </td>
              </tr>
            ) : (
              caches.map((cache) => {
                const fillPct = cache.capacity > 0 ? ((cache.entries / cache.capacity) * 100).toFixed(1) : "0.0";
                return (
                  <tr key={cache.name} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono">{cache.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{cache.entries.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{cache.capacity.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fillPct}%</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{cache.ttl || "—"}</td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => purge.mutate(cache.name)}
                        disabled={purge.isPending}
                        title={`Purge ${cache.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
