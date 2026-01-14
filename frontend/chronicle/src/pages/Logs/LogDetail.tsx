import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  FileText, 
  Clock, 
  LogIn, 
  Loader2, 
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  HardDrive,
  Server,
  Trash2,
  PauseCircle,
  XCircle,
  RotateCcw,
  RefreshCw,
  Play
} from "lucide-react";
import { Card } from "@/components/ui/Card/Card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useLogGroup, useDeleteLogGroup, useReparseLogGroup, type WoWLogGroupState, type WoWLogFile, type RiverJobState } from "@/api/queries";

function formatDate(timestamp: unknown): string {
  if (!timestamp) return "Unknown";
  // Handle the pgtype.Timestamptz format or ISO string
  const ts = timestamp as { Time?: string; Valid?: boolean } | string;
  if (typeof ts === "string") {
    return new Date(ts).toLocaleString();
  }
  if (ts.Valid && ts.Time) {
    return new Date(ts.Time).toLocaleString();
  }
  return "Unknown";
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// River job states - these match rivertype.JobState values
const RIVER_STATES = {
  available: "available",
  cancelled: "cancelled", 
  completed: "completed",
  discarded: "discarded",
  pending: "pending",
  retryable: "retryable",
  running: "running",
  scheduled: "scheduled",
} as const;

// Terminal states where no more processing will occur
const TERMINAL_STATES = [
  RIVER_STATES.completed,
  RIVER_STATES.discarded,
  RIVER_STATES.cancelled,
];

function isJobComplete(state: RiverJobState): boolean {
  return TERMINAL_STATES.includes(state as typeof TERMINAL_STATES[number]);
}

function formatJobKind(kind: string): string {
  // Convert snake_case or camelCase to readable format
  return kind
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function StatusBadge({ state }: { state: RiverJobState }) {
  switch (state) {
    case RIVER_STATES.completed:
      return (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Completed</span>
        </div>
      );
    case RIVER_STATES.running:
      return (
        <div className="flex items-center gap-2 text-blue-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">Processing</span>
        </div>
      );
    case RIVER_STATES.discarded:
      return (
        <div className="flex items-center gap-2 text-destructive">
          <XCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Failed</span>
        </div>
      );
    case RIVER_STATES.cancelled:
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <PauseCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Cancelled</span>
        </div>
      );
    case RIVER_STATES.retryable:
      return (
        <div className="flex items-center gap-2 text-yellow-600">
          <RotateCcw className="h-4 w-4" />
          <span className="text-sm font-medium">Retrying</span>
        </div>
      );
    case RIVER_STATES.scheduled:
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-medium">Scheduled</span>
        </div>
      );
    case RIVER_STATES.available:
    case RIVER_STATES.pending:
    default:
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-medium">Pending</span>
        </div>
      );
  }
}

export interface LogDetailViewProps {
  isAuthenticated: boolean;
  authLoading: boolean;
  log: WoWLogGroupState | undefined;
  logLoading: boolean;
  logError: Error | null;
  onDelete: () => void;
  isDeleting: boolean;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (show: boolean) => void;
  onReparse: () => void;
  isReparsing: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function LogDetailView({
  isAuthenticated,
  authLoading,
  log,
  logLoading,
  logError,
  onDelete,
  isDeleting,
  showDeleteConfirm,
  setShowDeleteConfirm,
  onReparse,
  isReparsing,
  onRefresh,
  isRefreshing,
}: LogDetailViewProps) {
  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      {/* Back link */}
      <Link 
        to="/logs" 
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Logs
      </Link>

      {/* Auth Check */}
      {!authLoading && !isAuthenticated ? (
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div>
              <h2 className="font-semibold text-lg">Authentication Required</h2>
              <p className="text-muted-foreground mt-1">
                You must be logged in to view log details.
              </p>
            </div>
            <Link to="/login?from=/logs">
              <Button>
                <LogIn className="h-4 w-4 mr-2" />
                Sign In
              </Button>
            </Link>
          </div>
        </Card>
      ) : logLoading ? (
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading log details...</p>
          </div>
        </Card>
      ) : logError ? (
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div>
              <h2 className="font-semibold text-lg text-destructive">Error Loading Log</h2>
              <p className="text-muted-foreground mt-1">
                {logError.message}
              </p>
            </div>
            <Link to="/logs">
              <Button variant="outline">
                Return to Logs
              </Button>
            </Link>
          </div>
        </Card>
      ) : !log ? (
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <div>
              <h2 className="font-semibold text-lg">Log Not Found</h2>
              <p className="text-muted-foreground mt-1">
                This log doesn't exist or you don't have access to it.
              </p>
            </div>
            <Link to="/logs">
              <Button variant="outline">
                Return to Logs
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">Log Upload</h1>
              <p className="text-muted-foreground mt-1">
                Uploaded {formatDate(log.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge state={log.status.state} />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button 
              variant="outline" 
              onClick={onReparse}
              disabled={isReparsing || !isJobComplete(log.status.state)}
            >
              {isReparsing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Reparsing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Reparse
                </>
              )}
            </Button>
          </div>

          {/* Processing Status Card */}
          <Card className="p-6">
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Server className="h-5 w-5 text-muted-foreground" />
              Processing Status
            </h2>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <StatusBadge state={log.status.state} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Job Type</p>
                  <p className="font-medium">{formatJobKind(log.status.kind)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Job ID</p>
                  <p className="font-mono text-sm">{log.status.id}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p>{formatDate(log.status.created_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Scheduled</p>
                  <p>{formatDate(log.status.scheduled_at)}</p>
                </div>
                {log.status.attempted_at && (
                  <div>
                    <p className="text-muted-foreground">Started</p>
                    <p>{formatDate(log.status.attempted_at)}</p>
                  </div>
                )}
                {log.status.finalized_at && (
                  <div>
                    <p className="text-muted-foreground">Completed</p>
                    <p>{formatDate(log.status.finalized_at)}</p>
                  </div>
                )}
              </div>

              {(log.status.state === RIVER_STATES.pending || 
                log.status.state === RIVER_STATES.available || 
                log.status.state === RIVER_STATES.scheduled) && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Your logs are queued for processing. This may take a few minutes depending on the file size.
                  </p>
                </div>
              )}

              {log.status.state === RIVER_STATES.running && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Your logs are currently being processed. Check back shortly for results.
                  </p>
                </div>
              )}

              {log.status.state === RIVER_STATES.retryable && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Processing encountered an issue and will be retried automatically.
                  </p>
                </div>
              )}

              {log.status.state === RIVER_STATES.discarded && log.status.errors.length > 0 && (
                <div className="p-4 bg-destructive/10 rounded-lg space-y-2">
                  <p className="text-sm font-medium text-destructive">Processing failed</p>
                  {log.status.errors.map((error, idx) => (
                    <div key={idx} className="text-sm">
                      <p className="text-muted-foreground">
                        Attempt {error.attempt} at {formatDate(error.at)}:
                      </p>
                      <p className="font-mono text-xs text-destructive whitespace-pre-wrap break-words">
                        {error.error}
                      </p>
                      {error.trace && (
                        <details className="mt-1">
                          <summary className="text-xs text-muted-foreground cursor-pointer">
                            Stack trace
                          </summary>
                          <pre className="text-xs text-muted-foreground mt-1 overflow-x-auto">
                            {error.trace}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Files Card */}
          <Card className="p-6">
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-muted-foreground" />
              Uploaded Files
            </h2>
            <div className="space-y-2">
              {log.files && log.files.length > 0 ? (
                log.files.map((file: WoWLogFile) => (
                  <div 
                    key={file.id} 
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{file.mime_type || "Log File"}</p>
                        <p className="text-xs text-muted-foreground">
                          ID: {file.id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>{formatBytes(file.size_bytes)}</p>
                      <p className="text-xs">{formatDate(file.created_at)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">No files found</p>
              )}
            </div>
          </Card>

          {/* Log Details Card */}
          <Card className="p-6">
            <h2 className="font-semibold text-lg mb-4">Details</h2>
            <dl className="grid gap-4 md:grid-cols-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Log ID</dt>
                <dd className="font-mono text-xs mt-1 break-all">{log.id}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Owner ID</dt>
                <dd className="font-mono text-xs mt-1 break-all">{log.owner}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="mt-1">{formatDate(log.created_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last Updated</dt>
                <dd className="mt-1">{formatDate(log.updated_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Total Files</dt>
                <dd className="mt-1">{log.files?.length || 0}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Total Size</dt>
                <dd className="mt-1">
                  {log.files 
                    ? formatBytes(log.files.reduce((acc, f) => acc + f.size_bytes, 0))
                    : "0 B"
                  }
                </dd>
              </div>
            </dl>
          </Card>

          {/* Delete Section */}
          <Card className="p-6 border-destructive/50">
            <h2 className="font-semibold text-lg mb-4 text-destructive">Danger Zone</h2>
            {showDeleteConfirm ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to delete this log? This action cannot be undone.
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="destructive" 
                    onClick={onDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Yes, Delete
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Permanently delete this log and all associated files.
                </p>
                <Button 
                  variant="destructive" 
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Log
                </Button>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

export function LogDetail() {
  const { logId } = useParams<{ logId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { 
    data: log, 
    isLoading: logLoading, 
    error: logError,
    refetch,
    isRefetching,
  } = useLogGroup(logId || "", {
    enabled: isAuthenticated && !!logId,
  });

  const deleteLogGroup = useDeleteLogGroup();
  const reparseLogGroup = useReparseLogGroup();

  const handleDelete = () => {
    if (!logId) return;
    deleteLogGroup.mutate(logId, {
      onSuccess: () => {
        toast.success("Log deleted");
        navigate("/logs");
      },
      onError: (error) => {
        toast.error("Failed to delete log", {
          description: error.message,
        });
      },
    });
  };

  const handleReparse = () => {
    if (!logId) return;
    reparseLogGroup.mutate(logId, {
      onSuccess: () => {
        toast.success("Reparse started", {
          description: "Your log is being reprocessed.",
        });
        refetch();
      },
      onError: (error) => {
        toast.error("Failed to reparse", {
          description: error.message,
        });
      },
    });
  };

  const handleRefresh = () => {
    refetch();
  };

  return (
    <LogDetailView
      isAuthenticated={isAuthenticated}
      authLoading={authLoading}
      log={log}
      logLoading={logLoading}
      logError={logError}
      onDelete={handleDelete}
      isDeleting={deleteLogGroup.isPending}
      showDeleteConfirm={showDeleteConfirm}
      setShowDeleteConfirm={setShowDeleteConfirm}
      onReparse={handleReparse}
      isReparsing={reparseLogGroup.isPending}
      onRefresh={handleRefresh}
      isRefreshing={isRefetching}
    />
  );
}
