import { Link, Outlet, useLocation } from "react-router-dom";
import { User, Bell, Shield, Palette } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Tab = {
  path: string;
  label: string;
  icon: LucideIcon;
};

const tabs: Tab[] = [
  { path: "/account/settings", label: "Profile", icon: User },
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
