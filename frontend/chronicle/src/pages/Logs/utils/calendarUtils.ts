import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import type { WoWLogGroup, WoWParsedLogJobOutput } from "@/api/queries";
import type { WoWSimpleParsedInstance } from "@/api/typesGenerated";

// Upload metadata for calendar display
export interface UploadMeta {
  id: string;
  uploadDate: Date;
  sizeBytes: number;
  instanceCount: number;
}

// Calendar data for a single day
export interface CalendarDayData {
  instances: InstanceWithMeta[];
  uploads: UploadMeta[];
}

// Instance with additional metadata for calendar display
export interface InstanceWithMeta extends WoWSimpleParsedInstance {
  logGroupId: string;
  uploadDate: Date;
  raidDate: Date | null;
  durationMs: number | null;
}

// Get the first encounter's start time as the "raid date"
export function getRaidDate(instance: WoWSimpleParsedInstance): Date | null {
  const firstEncounter = instance.encounters?.[0];
  if (!firstEncounter?.start_time) return null;
  return new Date(firstEncounter.start_time);
}

// Calculate instance duration from encounters
export function getInstanceDuration(instance: WoWSimpleParsedInstance): number | null {
  if (!instance.encounters || instance.encounters.length === 0) return null;
  
  const times = instance.encounters.map((e) => ({
    start: new Date(e.start_time).getTime(),
    end: new Date(e.end_time).getTime(),
  }));
  
  const minStart = Math.min(...times.map((t) => t.start));
  const maxEnd = Math.max(...times.map((t) => t.end));
  
  if (isNaN(minStart) || isNaN(maxEnd)) return null;
  return maxEnd - minStart;
}

// Format duration in human-readable form
export function formatDuration(ms: number | null): string {
  if (ms === null || ms === 0) return "";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Parse processing output safely
export function parseParsedOutput(output: unknown): WoWParsedLogJobOutput | null {
  if (!output || typeof output !== "object") {
    return null;
  }
  const parsed = output as WoWParsedLogJobOutput;
  if (!Array.isArray(parsed.instances)) {
    return null;
  }
  return parsed;
}

// Parse timestamp from log group
function parseTimestamp(timestamp: unknown): Date | null {
  if (!timestamp) return null;
  const ts = timestamp as { Time?: string; Valid?: boolean } | string;
  const dateStr = typeof ts === "string" ? ts : ts.Valid && ts.Time ? ts.Time : null;
  if (!dateStr) return null;
  return new Date(dateStr);
}

// Group logs by date for calendar display
// Instances always appear on their raid date
// Uploads appear on their upload date (separate from instances)
export function groupLogsByDate(
  logs: WoWLogGroup[] | undefined,
  instanceFilter: string | null
): Record<string, CalendarDayData> {
  const result: Record<string, CalendarDayData> = {};
  
  if (!logs) return result;
  
  for (const log of logs) {
    const parsed = parseParsedOutput(log.processing_output);
    const uploadDate = parseTimestamp(log.created_at);
    
    if (!uploadDate) continue;
    
    const totalSize = log.files?.reduce((acc, f) => acc + f.size_bytes, 0) ?? 0;
    const instanceCount = parsed?.instances?.length ?? 0;
    
    // Track uploads by upload date (always on upload date)
    const uploadKey = format(uploadDate, "yyyy-MM-dd");
    if (!result[uploadKey]) {
      result[uploadKey] = { instances: [], uploads: [] };
    }
    result[uploadKey].uploads.push({
      id: log.id,
      uploadDate,
      sizeBytes: totalSize,
      instanceCount,
    });
    
    if (parsed?.instances) {
      for (const inst of parsed.instances) {
        // Apply instance filter
        if (instanceFilter && inst.name !== instanceFilter) continue;
        
        // Instances always appear on their raid date
        const raidDate = getRaidDate(inst);
        const dateToUse = raidDate ?? uploadDate;
        const dayKey = format(dateToUse, "yyyy-MM-dd");
        
        if (!result[dayKey]) {
          result[dayKey] = { instances: [], uploads: [] };
        }
        
        result[dayKey].instances.push({
          ...inst,
          logGroupId: log.id,
          uploadDate,
          raidDate,
          durationMs: getInstanceDuration(inst),
        });
      }
    }
  }
  
  return result;
}

// Get all unique instance names from logs
export function getUniqueInstanceNames(logs: WoWLogGroup[] | undefined): string[] {
  if (!logs) return [];
  const names = new Set<string>();
  for (const log of logs) {
    const parsed = parseParsedOutput(log.processing_output);
    if (parsed?.instances) {
      for (const inst of parsed.instances) {
        names.add(inst.name);
      }
    }
  }
  return Array.from(names).sort();
}

// Get weeks for calendar display (6 weeks to ensure full month coverage)
export function getCalendarWeeks(month: Date): Date[][] {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  
  return weeks;
}

// Format date key for calendar data lookup
export function dateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

// Re-export useful date-fns functions
export { format, isSameMonth, isSameDay, isToday, addMonths, subMonths };
