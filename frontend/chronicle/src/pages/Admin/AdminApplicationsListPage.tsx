import { Link } from "react-router-dom";
import { useAdminServerApplications } from "@/api/queries";
import { Card } from "@/components/ui/Card/Card";
import {
  Loader2,
  ChevronRight,
  FileText,
  Clock,
} from "lucide-react";

export function AdminApplicationsListPage() {
  const { data: applications, isLoading } = useAdminServerApplications();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Server Applications</h1>

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !applications || applications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
            <FileText className="h-8 w-8" />
            <p>No applications found.</p>
          </div>
        ) : (
          <div className="divide-y">
            {applications.map((app) => {
              const pendingCount = app.requests?.filter((r) => r.status === "pending").length ?? 0;
              return (
                <Link
                  key={app.id}
                  to={`/apply/${app.id}`}
                  className="flex items-center gap-3 py-3 px-4 hover:bg-accent/50 transition-colors"
                >
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{app.name}</span>
                      {pendingCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-yellow-500/15 text-yellow-400">
                          <Clock className="h-3 w-3" />
                          {pendingCount} pending
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      by {app.username}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground w-24 text-right">
                    {new Date(app.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
