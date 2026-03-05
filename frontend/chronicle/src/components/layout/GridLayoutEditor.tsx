import { useEffect, useMemo, useRef, useState } from "react";
import GridLayout, { type LayoutItem } from "react-grid-layout";
import { GripVertical } from "lucide-react";
import "react-grid-layout/css/styles.css";
import { cn } from "@/lib/utils";

export interface GridEditorItem {
  id: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

interface GridLayoutEditorProps {
  items: GridEditorItem[];
  onItemsChange: (items: GridEditorItem[]) => void;
  renderItem: (item: GridEditorItem) => React.ReactNode;
  editable?: boolean;
  cols?: number;
  rowHeight?: number;
  className?: string;
  showItemHeader?: boolean;
}

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(1200);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });

    observer.observe(ref.current);
    setWidth(ref.current.offsetWidth);

    return () => observer.disconnect();
  }, [ref]);

  return width;
}

export function GridLayoutEditor({
  items,
  onItemsChange,
  renderItem,
  editable = true,
  cols = 12,
  rowHeight = 110,
  className,
  showItemHeader = true,
}: GridLayoutEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef);

  const layout = useMemo(
    () =>
      items.map((item) => ({
        i: item.id,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: item.minW ?? 4,
        minH: item.minH ?? 4,
        maxW: item.maxW ?? cols,
        maxH: item.maxH ?? 20,
      })),
    [items, cols]
  );

  const commitLayout = (newLayout: readonly LayoutItem[]) => {
    const byId = new Map(newLayout.map((entry) => [entry.i, entry]));
    const next = items.map((item) => {
      const entry = byId.get(item.id);
      if (!entry) return item;
      return {
        ...item,
        x: entry.x,
        y: entry.y,
        w: entry.w,
        h: entry.h,
      };
    });
    onItemsChange(next);
  };

  return (
    <div ref={containerRef} className={cn("w-full", className)}>
      <GridLayout
        className="layout"
        layout={layout}
        width={containerWidth}
        containerPadding={[0, 0]}
        gridConfig={{
          cols,
          rowHeight,
        }}
        dragConfig={{
          handle: ".grid-layout-editor-handle",
          enabled: editable,
        }}
        resizeConfig={{
          enabled: editable,
        }}
        onDragStop={(newLayout) => commitLayout(newLayout)}
        onResizeStop={(newLayout) => commitLayout(newLayout)}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-card border border-border rounded-lg overflow-hidden shadow-sm relative"
          >
            {showItemHeader ? (
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
                {editable && (
                  <div className="grid-layout-editor-handle flex h-7 w-7 items-center justify-center rounded-md border border-border/70 bg-background/80 cursor-move text-muted-foreground shadow-sm transition-colors hover:text-foreground hover:bg-background">
                    <GripVertical className="h-5 w-5" />
                  </div>
                )}
                <span className="text-sm font-medium">{item.title}</span>
              </div>
            ) : (
              editable && (
                <div className="grid-layout-editor-handle absolute left-2 top-2 z-20 flex h-8 w-8 items-center justify-center cursor-move rounded-md border border-border/70 bg-background/90 text-muted-foreground shadow-md transition-colors hover:text-foreground hover:bg-background">
                  <GripVertical className="h-5 w-5" />
                </div>
              )
            )}
            <div className={cn("overflow-auto styled-scrollbar", showItemHeader ? "h-[calc(100%-41px)] p-3" : "h-full p-0")}>
              {renderItem(item)}
            </div>
          </div>
        ))}
      </GridLayout>
    </div>
  );
}
