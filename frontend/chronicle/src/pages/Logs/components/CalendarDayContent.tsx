import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { InstanceDayCard } from "./InstanceDayCard";
import { UploadDayCard } from "./UploadDayCard";
import type { CalendarDayData } from "../utils/calendarUtils";

interface CalendarDayContentProps {
  dayData: CalendarDayData;
  showUploads: boolean;
}

export function CalendarDayContent({ dayData, showUploads }: CalendarDayContentProps) {
  const [expanded, setExpanded] = useState(false);
  
  const maxCollapsed = 3;
  
  // Get all items to potentially show
  const allInstances = dayData.instances;
  const allUploads = showUploads ? dayData.uploads : [];
  
  // Calculate what to show when collapsed
  const instancesShown = expanded ? allInstances : allInstances.slice(0, maxCollapsed);
  const remainingSlots = expanded ? Infinity : Math.max(0, maxCollapsed - instancesShown.length);
  const uploadsShown = expanded ? allUploads : allUploads.slice(0, remainingSlots);
  
  const totalItems = allInstances.length + allUploads.length;
  const hiddenCount = totalItems - (expanded ? totalItems : Math.min(totalItems, maxCollapsed));
  const hasMore = hiddenCount > 0;
  
  return (
    <>
      {/* Instances for this day */}
      {instancesShown.map((instance) => (
        <InstanceDayCard key={instance.id} instance={instance} />
      ))}
      
      {/* Upload cards (shown when "Show uploads" is on) */}
      {uploadsShown.map((upload) => (
        <UploadDayCard key={upload.id} upload={upload} />
      ))}
      
      {/* Expandable "+X more" / "Show less" toggle */}
      {(hasMore || expanded) && totalItems > maxCollapsed && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-[10px] text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted px-1.5 py-1 rounded text-center transition-colors flex items-center justify-center gap-0.5"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              +{hiddenCount} more
            </>
          )}
        </button>
      )}
    </>
  );
}
