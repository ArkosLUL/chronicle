import { useState, useRef, useCallback, useEffect } from "react";
import { X, Minimize2, Maximize2, Move, GripHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VideoTimestamp } from "@/api/typesGenerated";

// YouTube Player types
declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        config: {
          videoId: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}

interface YouTubeOverlayProps {
  videoUrl: string;
  timestamps?: readonly VideoTimestamp[];
  /** ISO timestamp to seek to (e.g., encounter start_time) */
  targetTime?: string;
  onClose: () => void;
}

function parseYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/,
    /youtube\.com\/shorts\/([^&?/]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Parse a time string "HH:MM:SS" to seconds since midnight
 */
function parseTimeToSeconds(timeStr: string): number | null {
  const match = timeStr.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Extract time-of-day in seconds from an ISO timestamp
 */
function isoToTimeOfDaySeconds(isoString: string): number {
  const date = new Date(isoString);
  return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
}

/**
 * Find the video time to seek to for a given target server time.
 * Uses the timestamps array to interpolate/extrapolate.
 */
function calculateVideoTime(
  targetTimeSeconds: number,
  timestamps: readonly VideoTimestamp[]
): number | null {
  if (timestamps.length === 0) return null;

  // Convert all timestamps to seconds and pair with video time
  const points = timestamps
    .map((ts) => ({
      serverSeconds: parseTimeToSeconds(ts.server_time),
      videoSeconds: ts.video_time_seconds,
    }))
    .filter((p): p is { serverSeconds: number; videoSeconds: number } => 
      p.serverSeconds !== null
    )
    .sort((a, b) => a.serverSeconds - b.serverSeconds);

  if (points.length === 0) return null;

  // Find the closest point(s) for interpolation
  // If target is before all points, extrapolate from first
  // If target is after all points, extrapolate from last
  // Otherwise, interpolate between two surrounding points

  const first = points[0];
  const last = points[points.length - 1];

  if (targetTimeSeconds <= first.serverSeconds) {
    // Extrapolate backwards from first point
    const diff = first.serverSeconds - targetTimeSeconds;
    return Math.max(0, first.videoSeconds - diff);
  }

  if (targetTimeSeconds >= last.serverSeconds) {
    // Extrapolate forwards from last point
    const diff = targetTimeSeconds - last.serverSeconds;
    return last.videoSeconds + diff;
  }

  // Find surrounding points and interpolate
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (targetTimeSeconds >= p1.serverSeconds && targetTimeSeconds <= p2.serverSeconds) {
      // Linear interpolation
      const serverRange = p2.serverSeconds - p1.serverSeconds;
      const videoRange = p2.videoSeconds - p1.videoSeconds;
      const t = (targetTimeSeconds - p1.serverSeconds) / serverRange;
      return p1.videoSeconds + t * videoRange;
    }
  }

  return null;
}

export function YouTubeOverlay({ videoUrl, timestamps, targetTime, onClose }: YouTubeOverlayProps) {
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [size, setSize] = useState({ width: 480, height: 270 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  const videoId = parseYouTubeVideoId(videoUrl);

  // Initialize player callback - defined before effects that use it
  const initPlayer = useCallback(() => {
    if (!videoId || playerRef.current) return;

    playerRef.current = new window.YT.Player("yt-overlay-player", {
      videoId,
      playerVars: {
        autoplay: 0,
        modestbranding: 1,
        rel: 0,
      },
      events: {
        onReady: () => {
          setPlayerReady(true);
        },
      },
    });
  }, [videoId]);

  // Load YouTube IFrame API and initialize player
  useEffect(() => {
    // If API already loaded, initialize player
    if (window.YT?.Player) {
      // Small delay to ensure DOM element exists
      const timer = setTimeout(initPlayer, 100);
      return () => clearTimeout(timer);
    }

    // Load API script if not present
    if (!document.getElementById("youtube-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "youtube-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }

    // Set up callback for when API is ready
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      initPlayer();
    };

    return () => {
      // Restore previous callback if any
      if (previousCallback) {
        window.onYouTubeIframeAPIReady = previousCallback;
      }
    };
  }, [initPlayer]);

  // Cleanup player on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, []);

  // Seek when targetTime changes
  useEffect(() => {
    if (!playerReady || !playerRef.current || !targetTime || !timestamps?.length) return;

    const targetSeconds = isoToTimeOfDaySeconds(targetTime);
    const videoTime = calculateVideoTime(targetSeconds, timestamps);

    if (videoTime !== null) {
      playerRef.current.seekTo(videoTime, true);
    }
  }, [targetTime, timestamps, playerReady]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [position]);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPosition({
      x: dragStartRef.current.posX + dx,
      y: dragStartRef.current.posY + dy,
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    };
  }, [size]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizeStartRef.current) return;
    const dx = e.clientX - resizeStartRef.current.x;
    // Maintain 16:9 aspect ratio based on width change
    const newWidth = Math.max(320, resizeStartRef.current.width + dx);
    const newHeight = Math.max(180, newWidth * (9 / 16));
    setSize({ width: newWidth, height: newHeight });
  }, []);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    resizeStartRef.current = null;
  }, []);

  // Global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleDragMove);
      window.addEventListener("mouseup", handleDragEnd);
      return () => {
        window.removeEventListener("mousemove", handleDragMove);
        window.removeEventListener("mouseup", handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", handleResizeMove);
      window.addEventListener("mouseup", handleResizeEnd);
      return () => {
        window.removeEventListener("mousemove", handleResizeMove);
        window.removeEventListener("mouseup", handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  if (!videoId) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed z-[60] bg-card border border-border rounded-lg shadow-2xl overflow-hidden",
        (isDragging || isResizing) && "select-none"
      )}
      style={{
        left: position.x,
        top: position.y,
        width: isMinimized ? 200 : size.width,
      }}
    >
      {/* Header / drag handle */}
      <div
        className="flex items-center justify-between gap-2 px-2 py-1.5 bg-muted/50 border-b border-border cursor-move"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Move className="h-3 w-3" />
          <span className="truncate max-w-[150px]">YouTube</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? (
              <Maximize2 className="h-3 w-3" />
            ) : (
              <Minimize2 className="h-3 w-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 hover:bg-destructive/20 hover:text-destructive"
            onClick={onClose}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Video player */}
      {!isMinimized && (
        <div className="relative" style={{ height: size.height }}>
          <div id="yt-overlay-player" className="w-full h-full" />
          
          {/* Resize handle */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-center justify-center bg-muted/80 rounded-tl"
            onMouseDown={handleResizeStart}
          >
            <GripHorizontal className="h-3 w-3 text-muted-foreground rotate-[-45deg]" />
          </div>
        </div>
      )}
    </div>
  );
}
