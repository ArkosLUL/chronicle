import { useSiteConfig, useUpdateSiteConfig } from "@/api/queries";
import { Loader2, Check, X } from "lucide-react";
import { Card } from "@/components/ui/Card/Card";
import { Button } from "@/components/ui/button";

export function AdminSiteSettingsPage() {
  const { data: config, isLoading } = useSiteConfig();
  const updateConfig = useUpdateSiteConfig();

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-muted-foreground">Loading settings...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <h2 className="text-lg font-semibold">Site Settings</h2>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">Signups Enabled</p>
          <p className="text-sm text-muted-foreground">
            When disabled, new users cannot register via OAuth or email/password.
          </p>
        </div>
        <Button
          variant={config?.signups_enabled ? "default" : "destructive"}
          size="sm"
          disabled={updateConfig.isPending}
          onClick={() => {
            updateConfig.mutate({ signups_enabled: !config?.signups_enabled });
          }}
        >
          {updateConfig.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : config?.signups_enabled ? (
            <>
              <Check className="h-4 w-4 mr-1" />
              Enabled
            </>
          ) : (
            <>
              <X className="h-4 w-4 mr-1" />
              Disabled
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
