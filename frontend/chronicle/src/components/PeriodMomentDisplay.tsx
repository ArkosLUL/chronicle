import type { PeriodMoment } from "@/api/typesGenerated";

interface PeriodMomentDisplayProps {
  moment: PeriodMoment | undefined;
  label?: string;
  /** Fallback text when moment is undefined */
  fallback?: string;
  /** Show only compact inline view (time + type badge) */
  compact?: boolean;
}

export function PeriodMomentDisplay({ 
  moment, 
  label,
  fallback = "N/A",
  compact = false,
}: PeriodMomentDisplayProps) {
  if (!moment) {
    return <span className="text-muted-foreground">{fallback}</span>;
  }
  
  const time = new Date(moment.timestamp).toLocaleTimeString();
  const messageType = moment.message_type?.replace("*messages.", "");
  
  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {label && <span className="text-muted-foreground">{label}:</span>}
        <span>{time}</span>
        {messageType && (
          <span className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground">
            {messageType}
          </span>
        )}
      </div>
    );
  }
  
  return (
    <div className="space-y-1">
      {label && <div className="text-muted-foreground text-xs">{label}</div>}
      <div className="flex items-center gap-2">
        <span>{time}</span>
        {messageType && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {messageType}
          </span>
        )}
      </div>
      {moment.message && Object.keys(moment.message).length > 0 && (
        <div className="pl-2 border-l border-border text-[10px] space-y-0.5">
          {Object.entries(moment.message).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <span className="text-muted-foreground">{key}:</span>
              <span className="break-all">{String(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
