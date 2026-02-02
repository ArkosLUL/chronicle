import { cn } from "@/lib/utils";

interface NumProps {
  children: React.ReactNode;
  className?: string;
  /** Suffix like "/s" or "%" */
  suffix?: string;
}

/**
 * Wrapper component for displaying statistical numbers with monospace font.
 * Ensures numbers align properly in tables and lists.
 */
export function Num({ children, className, suffix }: NumProps) {
  return (
    <span className={cn("font-mono", className)}>
      {children}{suffix}
    </span>
  );
}
