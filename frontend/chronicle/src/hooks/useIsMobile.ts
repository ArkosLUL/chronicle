import { useState, useEffect } from "react";

/**
 * Hook to detect if the viewport is mobile-sized.
 * Uses Tailwind's `lg` breakpoint (1024px) as the threshold to cover
 * phones in both portrait and landscape orientations.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 1024;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    
    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    // Set initial value
    setIsMobile(mediaQuery.matches);

    // Listen for changes
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isMobile;
}
