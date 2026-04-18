import { useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "farewell-banner-dismissed";

export function FarewellBanner() {
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
    <div className="relative bg-blue-500/10 border-b border-blue-500/30 py-2 px-4 text-center text-sm">
      <span className="font-medium text-blue-600 dark:text-blue-400">
        💙 Thank You
      </span>
      <span className="text-muted-foreground ml-2">
        With Turtle WoW closing its doors, Chronicle will be searching for a new
        home. Thank you all for your incredible support — it's been an honor
        serving this community.
      </span>
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-blue-500/20 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
