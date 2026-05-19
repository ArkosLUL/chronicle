import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/wowdb/items", label: "Items" },
  { to: "/wowdb/spells", label: "Spells" },
  { to: "/wowdb/creatures", label: "Creatures" },
  { to: "/wowdb/sets", label: "Item Sets" },
];

export function WoWDBLayout() {
  const [bannerDismissed, setBannerDismissed] = useState(() => sessionStorage.getItem("wowdb-banner-dismissed") === "1");

  const dismissBanner = () => {
    setBannerDismissed(true);
    sessionStorage.setItem("wowdb-banner-dismissed", "1");
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-4">
      {!bannerDismissed && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-yellow-700/40 bg-yellow-900/20 px-4 py-2.5 text-sm text-yellow-500/90">
          <span>This explorer is not intended to replace a full database explorer tool. It is purely for development purposes.</span>
          <button onClick={dismissBanner} className="shrink-0 text-yellow-600 hover:text-yellow-400 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex items-center gap-6 border-b border-gray-700/50 pb-3">
        <h1 className="text-lg font-bold text-white mr-2">WoW Database</h1>
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                "text-sm pb-2 -mb-3 border-b-2 transition-colors",
                isActive
                  ? "text-white border-blue-500"
                  : "text-gray-400 border-transparent hover:text-gray-200"
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
