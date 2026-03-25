import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import type { DeviceVisibility } from "@/api/typesGenerated";
import { useGuildPage } from "@/api/queries";
import { GuildPageCanvas, TabBar } from "./components";
import { ArrowLeft, Pencil, Shield } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";

// Helper to check if an item should be visible on current device
function isVisibleOnDevice(visibility: DeviceVisibility | undefined, isMobile: boolean): boolean {
  if (!visibility || visibility === "all") return true;
  if (visibility === "mobile") return isMobile;
  if (visibility === "desktop") return !isMobile;
  return true;
}

export function GuildPage() {
  const { guildId, tabSlug } = useParams<{ guildId: string; tabSlug?: string }>();
  const [activeTab, setActiveTab] = useState<string>(tabSlug || "overview");
  const isMobile = useIsMobile();

  const { data: pageConfig, isLoading, error } = useGuildPage(guildId);

  // Filter tabs and panels based on device visibility
  const visibleTabs = useMemo(() => {
    if (!pageConfig?.tabs) return [];
    return pageConfig.tabs
      .filter((tab) => isVisibleOnDevice(tab.visibility, isMobile))
      .map((tab) => ({
        ...tab,
        panels: tab.panels.filter((panel) => isVisibleOnDevice(panel.visibility, isMobile)),
      }));
  }, [pageConfig?.tabs, isMobile]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !pageConfig) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Shield className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Guild Page Not Found</h2>
        <p className="text-muted-foreground">
          This guild doesn't have a public page yet.
        </p>
        <Link to="/" className="mt-4 text-primary hover:underline">
          Back to Home
        </Link>
      </div>
    );
  }

  const currentTab = visibleTabs.find((t) => t.slug === activeTab) || visibleTabs[0];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{pageConfig.guild.name}</h1>
            <p className="text-sm text-muted-foreground">{pageConfig.guild.realm_name}</p>
          </div>
        </div>
        {pageConfig.guild.can_edit && (
          <Link
            to={`/guilds/${guildId}/edit`}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Pencil className="h-4 w-4" />
            Edit Page
          </Link>
        )}
      </div>

      {/* Tab Navigation */}
      <TabBar
        tabs={visibleTabs}
        activeTab={activeTab}
        isEditing={false}
        onTabChange={setActiveTab}
      />

      {/* Content */}
      {currentTab && (
        <GuildPageCanvas
          guild={pageConfig.guild}
          panels={currentTab.panels}
          isEditing={false}
        />
      )}
    </div>
  );
}
