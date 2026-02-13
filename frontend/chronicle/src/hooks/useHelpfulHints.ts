/**
 * Hook to check if helpful hints (tooltips, help icons) should be shown.
 * 
 * The preference is stored server-side and returned from /api/v1/whoami.
 * Defaults to true for unauthenticated users or while loading.
 */

import { useSession } from "@/api/queries";

/**
 * Returns whether helpful hints should be displayed.
 * - Returns `true` while loading or for unauthenticated users (show hints by default)
 * - Returns the user's preference once loaded
 */
export function useHelpfulHints(): boolean {
  const { data: session, isLoading } = useSession();
  
  // Default to showing hints while loading or if not authenticated
  if (isLoading || !session) {
    return true;
  }
  
  return session.preferences.helpful_hints;
}
