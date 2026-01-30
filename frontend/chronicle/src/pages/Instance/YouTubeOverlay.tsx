import { useState, useRef, useCallback, useEffect } from "react";
import { X, Minimize2, Maximize2, Move, GripHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface YouTubeOverlayProps {
  videoUrl: string;
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

export function YouTubeOverlay({ videoUrl, onClose }: YouTubeOverlayProps) {
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [size, setSize] = useState({ width: 480, height: 270 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  const videoId = parseYouTubeVideoId(videoUrl);

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

      {/* Video iframe */}
      {!isMinimized && (
        <div className="relative" style={{ height: size.height }}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          
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
