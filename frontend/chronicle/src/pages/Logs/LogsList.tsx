import { Link } from "react-router-dom";
import { FileText, Clock, LogIn, Loader2, Upload as UploadIcon, Castle, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/Card/Card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useLogGroups, type WoWLogGroup, type WoWParsedLogJobOutput } from "@/api/queries";

function formatDate(timestamp: unknown): string {
  if (!timestamp) return "Unknown";
  // Handle the pgtype.Timestamptz format
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

function parseParsedOutput(output: unknown): WoWParsedLogJobOutput | null {
  if (!output || typeof output !== "object") {
    return null;
  }
  const parsed = output as WoWParsedLogJobOutput;
  // Check if it has the expected shape
  if (!Array.isArray(parsed.instances)) {
    return null;
  }
  return parsed;
}

export interface LogsListViewProps {
  isAuthenticated: boolean;
  authLoading: boolean;
  logs: WoWLogGroup[] | undefined;
  logsLoading: boolean;
  logsError: Error | null;
}

export function LogsListView({
  isAuthenticated,
  authLoading,
  logs,
  logsLoading,
  logsError,
}: LogsListViewProps) {
  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your Logs</h1>
          <p className="text-muted-foreground mt-2">
            View and manage your uploaded raid logs.
          </p>
        </div>
        <Link to="/upload">
          <Button>
            <UploadIcon className="h-4 w-4 mr-2" />
            Upload New
          </Button>
        </Link>
      </div>

      {/* Auth Check */}
      {!authLoading && !isAuthenticated ? (
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div>
              <h2 className="font-semibold text-lg">Authentication Required</h2>
              <p className="text-muted-foreground mt-1">
                You must be logged in to view your logs.
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
      ) : logsLoading ? (
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading your logs...</p>
          </div>
        </Card>
      ) : logsError ? (
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div>
              <h2 className="font-semibold text-lg text-destructive">Error Loading Logs</h2>
              <p className="text-muted-foreground mt-1">
                {logsError.message}
              </p>
            </div>
          </div>
        </Card>
      ) : logs && logs.length === 0 ? (
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <div>
              <h2 className="font-semibold text-lg">No Logs Found</h2>
              <p className="text-muted-foreground mt-1">
                You haven't uploaded any logs yet.
              </p>
            </div>
            <Link to="/upload">
              <Button>
                <UploadIcon className="h-4 w-4 mr-2" />
                Upload Your First Log
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {logs?.map((log) => {
            const parsedOutput = parseParsedOutput(log.processing_output);
            const instanceNames = parsedOutput?.instances.map(i => i.name) ?? [];
            const failedInstances = Object.keys(parsedOutput?.instance_failures ?? {});
            
            return (
              <Link key={log.id} to={`/logs/${log.id}`} className="block">
                <Card className="p-4 hover:bg-accent transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <h3 className="font-medium">Log Upload</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatDate(log.created_at)}</span>
                        </div>
                        {/* Parsed instances info */}
                        {(instanceNames.length > 0 || failedInstances.length > 0) && (
                          <ul className="mt-2 ml-1 space-y-1 text-sm">
                            {instanceNames.map((name) => (
                              <li key={name} className="flex items-center gap-2">
                                <Castle className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span>{name}</span>
                              </li>
                            ))}
                            {failedInstances.length > 0 && (
                              <li className="flex items-center gap-2 text-destructive">
                                <AlertCircle className="h-3 w-3 flex-shrink-0" />
                                <span>{failedInstances.length} failed to parse</span>
                              </li>
                            )}
                          </ul>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>{log.files?.length || 0} files</p>
                      <p>
                        {log.files?.reduce((acc, f) => acc + f.size_bytes, 0)
                          ? formatBytes(log.files.reduce((acc, f) => acc + f.size_bytes, 0))
                          : ""}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function LogsList() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: logs, isLoading: logsLoading, error: logsError } = useLogGroups({
    enabled: isAuthenticated,
  });

  return (
    <LogsListView
      isAuthenticated={isAuthenticated}
      authLoading={authLoading}
      logs={logs}
      logsLoading={logsLoading}
      logsError={logsError}
    />
  );
}
