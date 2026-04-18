import { Link } from "react-router-dom";
import { useAdminOutdatedInstances, useReparseLogGroup } from "@/api/queries";
import { Card } from "@/components/ui/Card/Card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export function AdminOutdatedInstancesPage() {
  const { data, isLoading, error, refetch } = useAdminOutdatedInstances();
  const reparseLogGroup = useReparseLogGroup();
  const [reparsingIds, setReparsingIds] = useState<Set<string>>(new Set());

  const handleReparse = (logGroupId: string, name: string) => {
    setReparsingIds((prev) => new Set(prev).add(logGroupId));
    reparseLogGroup.mutate(
      { logId: logGroupId },
      {
        onSuccess: () => {
          toast.success("Reparse started", {
            description: `Reparsing ${name}`,
          });
          refetch();
        },
        onError: (err) => {
          toast.error("Failed to reparse", {
            description: err.message,
          });
        },
        onSettled: () => {
          setReparsingIds((prev) => {
            const next = new Set(prev);
            next.delete(logGroupId);
            return next;
          });
        },
      }
    );
  };

  return (
    <div className="container mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Admin
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Outdated Parser Instances</h1>
        {data && (
          <span className="text-sm text-muted-foreground">
            Current: <code className="bg-muted px-1 rounded">{data.current_version}</code>
          </span>
        )}
      </div>

      <Card className="p-4">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        {error && (
          <div className="text-red-500 py-4">
            Failed to load instances: {error.message}
          </div>
        )}
        {data && data.instances.length === 0 && (
          <div className="text-muted-foreground py-8 text-center">
            All instances are on the latest parser version.
          </div>
        )}
        {data && data.instances.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 px-3">Instance</th>
                  <th className="py-2 px-3">Realm</th>
                  <th className="py-2 px-3">Uploader</th>
                  <th className="py-2 px-3">Uploaded</th>
                  <th className="py-2 px-3">Parser Version</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.instances.map((instance) => (
                  <tr key={instance.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3">
                      {instance.slug ? (
                        <Link
                          to={`/instance/${instance.slug}`}
                          className="text-blue-500 hover:underline"
                        >
                          {instance.name}
                        </Link>
                      ) : (
                        instance.name
                      )}
                    </td>
                    <td className="py-2 px-3">{instance.realm_name}</td>
                    <td className="py-2 px-3">{instance.uploader_name}</td>
                    <td className="py-2 px-3">
                      {new Date(instance.uploaded_at).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-3">
                      <code className="bg-muted px-1 rounded text-xs">
                        {instance.parser_version}
                      </code>
                    </td>
                    <td className="py-2 px-3">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={reparsingIds.has(instance.log_group_id)}
                        onClick={() =>
                          handleReparse(instance.log_group_id, instance.name)
                        }
                      >
                        {reparsingIds.has(instance.log_group_id) ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        Reparse
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
