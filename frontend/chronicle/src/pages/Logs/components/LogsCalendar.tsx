import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getCalendarWeeks,
  format,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from "../utils/calendarUtils";
import { CalendarAgendaView } from "./CalendarAgendaView";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface LogsCalendarProps {
  month: Date;
  onMonthChange: (date: Date) => void;
  dayContent: (date: Date) => React.ReactNode;
  headerRight?: React.ReactNode;
}

function useIsSmallScreen(): boolean {
  const [isSmall, setIsSmall] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    const handler = (e: MediaQueryListEvent) => setIsSmall(e.matches);
    setIsSmall(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isSmall;
}

export function LogsCalendar({
  month,
  onMonthChange,
  dayContent,
  headerRight,
}: LogsCalendarProps) {
  const isSmall = useIsSmallScreen();
  const weeks = getCalendarWeeks(month);

  if (isSmall) {
    return (
      <CalendarAgendaView
        month={month}
        onMonthChange={onMonthChange}
        dayContent={dayContent}
        headerRight={headerRight}
      />
    );
  }

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

      {/* Calendar grid - horizontal scroll on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="border border-border rounded-lg overflow-hidden min-w-[500px] sm:min-w-0">
          {/* Day names header */}
          <div className="grid grid-cols-7 bg-muted/50">
            {DAY_NAMES.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-xs font-medium text-muted-foreground border-b border-border"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7">
              {week.map((date, dayIndex) => {
                const inCurrentMonth = isSameMonth(date, month);
                const today = isToday(date);

                return (
                  <div
                    key={dayIndex}
                    className={`
                      min-h-[80px] sm:min-h-[100px] p-1 sm:p-1.5 border-b border-r border-border last:border-r-0
                      ${!inCurrentMonth ? "bg-muted/30" : ""}
                      ${today ? "bg-primary/5" : ""}
                    `}
                  >
                    {/* Date number */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`
                          text-xs sm:text-sm font-medium
                          ${!inCurrentMonth ? "text-muted-foreground/50" : ""}
                          ${today ? "text-primary font-bold" : ""}
                        `}
                      >
                        {format(date, "d")}
                      </span>
                      {today && (
                        <span className="text-[10px] sm:text-xs text-primary font-medium">
                          Today
                        </span>
                      )}
                    </div>

                    {/* Day content (instances, upload badges, etc.) */}
                    <div className="space-y-1">{dayContent(date)}</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
