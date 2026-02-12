import { useSupportedInstances } from "@/api/queries";
import { Loader2 } from "lucide-react";

export function SupportedInstances() {
  const { data: supportedInstances, isLoading, error } = useSupportedInstances();

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Supported Instances</h1>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      ) : error ? (
        <p className="text-destructive">Failed to load supported instances.</p>
      ) : supportedInstances ? (
        <ul className="space-y-2 text-muted-foreground">
          {Object.entries(supportedInstances)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([instance, note]) => (
              <li key={instance} className="flex flex-col">
                <span className="text-foreground">{instance}</span>
                {note && (
                  <span className="text-sm text-muted-foreground/70 ml-4">
                    {note}
                  </span>
                )}
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
