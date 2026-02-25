import { useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "early-access-banner-dismissed";

export function EarlyAccessBanner() {
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  if (dismissed) {
    return null;
  }

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  };

  return (
    <div className="relative bg-amber-500/10 border-b border-amber-500/30 py-2 px-4 text-center text-sm">
      <span className="font-medium text-amber-600 dark:text-amber-400">
        🔒 Early Access
      </span>
      <span className="text-muted-foreground ml-2">
        Chronicle is currently in closed beta. Approval is required to join.
      </span>
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-amber-500/20 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
