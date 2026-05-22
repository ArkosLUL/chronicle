import { useState } from "react";
import { Link } from "react-router-dom";
import { useAdminServerApplications } from "@/api/queries";
import { Card } from "@/components/ui/Card/Card";
import {
  Loader2,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
} from "lucide-react";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "approved":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-green-500/15 text-green-400">
          <CheckCircle2 className="h-3 w-3" />
          Approved
        </span>
      );
    case "rejected":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-red-500/15 text-red-400">
          <XCircle className="h-3 w-3" />
          Rejected
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-yellow-500/15 text-yellow-400">
          <Clock className="h-3 w-3" />
          Pending
        </span>
      );
  }
}

export function AdminApplicationsListPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const { data: applications, isLoading } = useAdminServerApplications(
    statusFilter || undefined,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Server Applications</h1>
        <select
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

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
            {applications.map((app) => (
              <Link
                key={app.id}
                to={`/apply/${app.id}`}
                className="flex items-center gap-3 py-3 px-4 hover:bg-accent/50 transition-colors"
              >
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{app.name}</span>
                    <StatusBadge status={app.status} />
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
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
