import { Link, Outlet, useLocation } from "react-router-dom";
import { User, Bell, Shield, Palette, HardDrive, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMyStorage } from "@/api/queries";
import type { DataGrant } from "@/api/typesGenerated";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatExpirationDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return "Expired";
  if (diffDays === 0) return "Expires today";
  if (diffDays === 1) return "Expires tomorrow";
  if (diffDays <= 7) return `Expires in ${diffDays} days`;
  if (diffDays <= 30) return `Expires in ${Math.ceil(diffDays / 7)} weeks`;
  
  return `Expires ${date.toLocaleDateString()}`;
}

type Tab = {
  path: string;
  label: string;
  icon: LucideIcon;
};

const tabs: Tab[] = [
  { path: "/account/settings", label: "Profile", icon: User },
  { path: "/account/storage", label: "Storage", icon: HardDrive },
  { path: "/account/notifications", label: "Notifications", icon: Bell },
  { path: "/account/privacy", label: "Privacy", icon: Shield },
  { path: "/account/appearance", label: "Appearance", icon: Palette },
];

export function AccountLayout() {
  const location = useLocation();

  return (
    <div className="flex min-h-[calc(100vh-8rem)]">
      {/* Sidebar */}
      <nav className="w-64 border-r p-4">
        <h1 className="text-lg font-semibold mb-4">Settings</h1>
        <ul className="space-y-1">
          {tabs.map((tab) => (
            <li key={tab.path}>
              <Link
                to={tab.path}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  location.pathname === tab.path
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Content */}
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}

export function ProfileSettings() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Profile Settings</h2>
      <p className="text-muted-foreground">Manage your profile information.</p>
    </div>
  );
}

export function NotificationSettings() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Notification Preferences</h2>
      <p className="text-muted-foreground">Configure how you receive notifications.</p>
    </div>
  );
}

export function PrivacySettings() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Privacy Settings</h2>
      <p className="text-muted-foreground">Control your privacy and data.</p>
    </div>
  );
}

export function AppearanceSettings() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Appearance</h2>
      <p className="text-muted-foreground">Customize the look and feel.</p>
    </div>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  base: "Base Allocation",
  support: "Supporter Bonus",
  "alpha-tester": "Alpha Tester Reward",
  "beta-tester": "Beta Tester Reward",
  promotion: "Promotional Bonus",
};

function formatSource(source: string): string {
  return SOURCE_LABELS[source] || source.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StorageSettings() {
  const { data: storage, isLoading } = useMyStorage();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Storage</h2>
        <p className="text-muted-foreground">Loading storage information...</p>
      </div>
    );
  }

  if (!storage) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Storage</h2>
        <p className="text-muted-foreground">Unable to load storage information.</p>
      </div>
    );
  }

  const usagePercent = storage.max_storage_bytes > 0
    ? (storage.consumed_storage_bytes / storage.max_storage_bytes) * 100
    : 0;

  const getProgressColor = () => {
    if (usagePercent >= 95) return "bg-red-500";
    if (usagePercent >= 80) return "bg-yellow-500";
    return "bg-primary";
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Storage</h2>
        <p className="text-muted-foreground">View your storage usage and grants.</p>
      </div>

      {/* Storage Usage Bar */}
      <div className="rounded-lg border p-6 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Storage Used</span>
          <span className="text-sm text-muted-foreground">
            {formatBytes(storage.consumed_storage_bytes)} of {formatBytes(storage.max_storage_bytes)}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div 
            className={`h-full transition-all ${getProgressColor()}`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
        {usagePercent >= 80 && (
          <p className={`text-sm ${usagePercent >= 95 ? "text-red-500" : "text-yellow-500"}`}>
            {usagePercent >= 95
              ? "You've nearly reached your storage limit. Delete some logs to free up space."
              : "You're approaching your storage limit."}
          </p>
        )}
      </div>

      {/* Storage Grants */}
      <div className="rounded-lg border">
        <div className="p-4 border-b">
          <h3 className="font-medium">Storage Grants</h3>
          <p className="text-sm text-muted-foreground">
            Your total storage is the sum of all active grants below.
          </p>
        </div>
        <div className="divide-y">
          {storage.grants.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No storage grants found.</div>
          ) : (
            storage.grants.map((grant: DataGrant) => {
              const isExpired = grant.expires_at && new Date(grant.expires_at) < new Date();
              const isExpiringSoon = grant.expires_at && !isExpired && 
                new Date(grant.expires_at).getTime() - new Date().getTime() < 7 * 24 * 60 * 60 * 1000;
              
              return (
                <div key={grant.id} className={`p-4 flex justify-between items-center ${isExpired ? "opacity-50" : ""}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatSource(grant.source)}</span>
                      {grant.expires_at && (
                        <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
                          isExpired 
                            ? "bg-destructive/15 text-destructive" 
                            : isExpiringSoon 
                              ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
                              : "bg-muted text-muted-foreground"
                        }`}>
                          <Clock className="h-3 w-3" />
                          {formatExpirationDate(grant.expires_at)}
                        </span>
                      )}
                    </div>
                    {grant.description && (
                      <div className="text-sm text-muted-foreground">{grant.description}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatBytes(grant.storage_bytes)}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(grant.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
