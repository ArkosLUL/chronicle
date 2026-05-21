import { useState, useEffect } from "react";
import { useSiteConfig, useUpdateSiteConfig } from "@/api/queries";
import { Loader2, Check, X } from "lucide-react";
import { Card } from "@/components/ui/Card/Card";
import { Button } from "@/components/ui/button";

export function AdminSiteSettingsPage() {
  const { data: config, isLoading } = useSiteConfig();
  const updateConfig = useUpdateSiteConfig();

  // Branding state — synced from server data.
  const [squareLogo, setSquareLogo] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [backgroundBanner, setBackgroundBanner] = useState("");

  useEffect(() => {
    if (config?.branding) {
      setSquareLogo(config.branding.square_logo ?? "");
      setDisplayName(config.branding.display_name ?? "");
      setTagline(config.branding.tagline ?? "");
      setDescription(config.branding.description ?? "");
      setBackgroundBanner(config.branding.background_banner ?? "");
    }
  }, [config?.branding]);

  const saveBranding = () => {
    const hasBranding = squareLogo || displayName || tagline || description || backgroundBanner;
    updateConfig.mutate({
      branding: hasBranding
        ? {
            square_logo: squareLogo || undefined,
            display_name: displayName || undefined,
            tagline: tagline || undefined,
            description: description || undefined,
            background_banner: backgroundBanner || undefined,
          }
        : ({} as never), // empty object clears branding
    });
  };

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

  const inputClass = "w-full rounded-md border bg-background px-3 py-1.5 text-sm";

  return (
    <div className="space-y-4">
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

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Primary Domain Branding</h2>
        <p className="text-sm text-muted-foreground">
          Visual identity for the main site. Tenant subdomains use their own branding.
        </p>
        <div className="space-y-2">
          <input className={inputClass} placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <input className={inputClass} placeholder="Tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} />
          <input className={inputClass} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <input className={inputClass} placeholder="Square logo URL" value={squareLogo} onChange={(e) => setSquareLogo(e.target.value)} />
          <input className={inputClass} placeholder="Background banner URL" value={backgroundBanner} onChange={(e) => setBackgroundBanner(e.target.value)} />
        </div>
        <Button size="sm" disabled={updateConfig.isPending} onClick={saveBranding}>
          {updateConfig.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Branding"}
        </Button>
      </Card>
    </div>
  );
}
