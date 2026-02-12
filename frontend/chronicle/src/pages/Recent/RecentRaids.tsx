import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Castle } from "lucide-react";
import { Card } from "@/components/ui/Card/Card";
import { Button } from "@/components/ui/button";
import { RaidCard } from "./RaidCard";
import type { RecentInstance, RecentInstancesResponse } from "@/api/typesGenerated";

const API_BASE = "/api/v1/raidlogs";

export function RecentRaids() {
  const [instances, setInstances] = useState<RecentInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);



  // Fetch instances
  const fetchInstances = useCallback(async (cursor?: string | null) => {
    const isInitial = !cursor;
    if (isInitial) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("limit", "24");
      if (cursor) params.set("cursor", cursor);

      const response = await fetch(`${API_BASE}/recent?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const data: RecentInstancesResponse = await response.json();

      if (isInitial) {
        setInstances([...data.instances]);
      } else {
        setInstances(prev => [...prev, ...data.instances]);
      }
      
      setHasMore(data.has_more);
      setNextCursor(data.next_cursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recent raids");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial load and reload on filter change
  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  // Infinite scroll observer
  const loadMoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMore || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor) {
          fetchInstances(nextCursor);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingMore, nextCursor, fetchInstances]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Castle className="h-7 w-7" />
          Recent Raids
        </h1>
        <p className="text-muted-foreground mt-1">
          Browse the latest dungeon & raid uploads from the community
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <Card className="p-8 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => fetchInstances()}>Try Again</Button>
        </Card>
      )}

      {/* Empty state */}
      {!loading && !error && instances.length === 0 && (
        <Card className="p-12 text-center">
          <Castle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No raids found</h3>
          <p className="text-muted-foreground">
            No raids have been uploaded yet. Be the first!
          </p>
        </Card>
      )}

      {/* Raid grid */}
      {!loading && instances.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {instances.map((instance) => (
              <RaidCard key={instance.id} instance={instance} />
            ))}
          </div>

          {/* Infinite scroll trigger */}
          {hasMore && (
            <div ref={loadMoreRef} className="flex justify-center py-8">
              {loadingMore ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <span className="text-sm text-muted-foreground">Scroll for more</span>
              )}
            </div>
          )}

          {/* End of results */}
          {!hasMore && instances.length > 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              You've reached the end! {instances.length} raids shown.
            </p>
          )}
        </>
      )}
    </div>
  );
}
