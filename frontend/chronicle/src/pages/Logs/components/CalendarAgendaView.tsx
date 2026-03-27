import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  format,
  addMonths,
  subMonths,
  isToday,
} from "../utils/calendarUtils";
import { startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";

interface CalendarAgendaViewProps {
  month: Date;
  onMonthChange: (date: Date) => void;
  dayContent: (date: Date) => React.ReactNode;
  headerRight?: React.ReactNode;
}

export function CalendarAgendaView({
  month,
  onMonthChange,
  dayContent,
  headerRight,
}: CalendarAgendaViewProps) {
  const days = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  });

  // Only show days that have content
  const daysWithContent = days
    .map((date) => ({ date, content: dayContent(date) }))
    .filter(({ content }) => content !== null && content !== undefined)
    .reverse();

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">
            {format(month, "MMMM yyyy")}
          </h2>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onMonthChange(subMonths(month, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onMonthChange(addMonths(month, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {headerRight}
      </div>

      {/* Agenda list */}
      {daysWithContent.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">
          No activity this month
        </div>
      ) : (
        <div className="space-y-2">
          {daysWithContent.map(({ date, content }) => (
            <div
              key={date.toISOString()}
              className={`rounded-lg border border-border p-3 ${isToday(date) ? "border-primary/50 bg-primary/5" : ""}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-sm font-medium ${isToday(date) ? "text-primary" : "text-muted-foreground"}`}
                >
                  {format(date, "EEE, MMM d")}
                </span>
                {isToday(date) && (
                  <span className="text-xs text-primary font-medium">
                    Today
                  </span>
                )}
              </div>
              <div className="space-y-1">{content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
