import { useEffect, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ParsedDocument, SessionEvent } from "../types.js";

interface EventFeedProps {
  events: SessionEvent[];
  document: ParsedDocument;
}

/**
 * Chronological sidebar of speech + activity captured during reading.
 * Uses TanStack Virtual for efficient rendering of potentially long
 * event feeds, with "stick to bottom" behavior: auto-scrolls to the
 * newest entry unless the user has scrolled up to review history.
 */
export function EventFeed({ events, document }: EventFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Starts true — user is at bottom until they explicitly scroll up.
  const stickyRef = useRef(true);
  // Prevents the generic scroll handler from misreading a programmatic scroll.
  const isAutoScrollingRef = useRef(false);

  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 80,
    measureElement: (element) => element?.getBoundingClientRect().height ?? 80,
    overscan: 10,
  });

  // Only adjust scroll position for items above the viewport when the user
  // is scrolling backward (reviewing history). Never adjust when items at
  // the bottom are growing (pending transcript deltas).
  virtualizer.shouldAdjustScrollPositionOnItemSizeChange = (
    item,
    _delta,
    instance,
  ) =>
    item.start < (instance.scrollOffset ?? 0) &&
    instance.scrollDirection === "backward";

  // Detect USER scrolling intent (wheel, touch, scrollbar drag). These
  // never fire from virtualizer.scrollToIndex, so they cleanly distinguish
  // "user scrolled away" from "we programmatically scrolled."
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const updateSticky = () => {
      // Wait one frame so the browser has applied the scroll.
      requestAnimationFrame(() => {
        if (isAutoScrollingRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = el;
        stickyRef.current = scrollHeight - scrollTop - clientHeight < 100;
      });
    };

    el.addEventListener("wheel", updateSticky, { passive: true });
    el.addEventListener("touchend", updateSticky, { passive: true });
    // pointerup catches scrollbar drag release
    el.addEventListener("pointerup", updateSticky, { passive: true });
    return () => {
      el.removeEventListener("wheel", updateSticky);
      el.removeEventListener("touchend", updateSticky);
      el.removeEventListener("pointerup", updateSticky);
    };
  }, []);

  // Compute a stable "content fingerprint" that changes when we should
  // re-anchor to the bottom. Two cases:
  //   1. A new event was added (events.length changed).
  //   2. The pending transcript grew (text changed — we need to keep the
  //      bottom in view as it expands).
  const lastEvent = events.length > 0 ? events[events.length - 1] : undefined;
  const pendingLen =
    lastEvent?.kind === "transcript" && lastEvent.pending
      ? lastEvent.text.length
      : -1;

  useEffect(() => {
    if (!stickyRef.current || events.length === 0) return;

    isAutoScrollingRef.current = true;
    requestAnimationFrame(() => {
      virtualizer.scrollToIndex(events.length - 1, { align: "end" });
      // Clear the flag after the browser has applied the scroll and any
      // resulting scroll events have fired.
      requestAnimationFrame(() => {
        isAutoScrollingRef.current = false;
      });
    });
    // We intentionally use events.length + pendingLen as the triggers,
    // not the full events array or virtualizer instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.length, pendingLen]);

  const segmentLabel = useCallback(
    (id: string) => {
      const seg = document.segments.find((s) => s.id === id);
      if (!seg) return id;
      const text = seg.plainText.slice(0, 60);
      return text.length < seg.plainText.length ? `${text}…` : text;
    },
    [document.segments],
  );

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto px-4 py-4 text-sm">
      {events.length === 0 && (
        <p className="text-gray-500 italic">
          Start talking and scrolling — activity will appear here.
        </p>
      )}
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: "relative",
          width: "100%",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const event = events[virtualRow.index];
          if (!event) return null;
          return (
            <div
              key={event.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="pb-2">
                <EventRow event={event} segmentLabel={segmentLabel} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventRow({
  event,
  segmentLabel,
}: {
  event: SessionEvent;
  segmentLabel: (id: string) => string;
}) {
  if (event.kind === "transcript") {
    return (
      <div
        className={`rounded-lg border px-3 py-2 ${
          event.pending
            ? "border-blue-500/60 bg-blue-500/10"
            : "border-gray-700 bg-gray-900/60"
        }`}
      >
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-500 mb-1">
          <span>Voice</span>
          <span>{formatTime(event.startTime)}</span>
          {event.pending && <span className="text-blue-400">• live</span>}
        </div>
        <p className="text-gray-100 whitespace-pre-wrap">{event.text}</p>
      </div>
    );
  }

  if (event.kind === "scroll") {
    return (
      <div className="rounded-md border border-gray-800 bg-gray-900/30 px-3 py-1.5">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-500">
          <span>Scroll</span>
          <span>{formatTime(event.time)}</span>
        </div>
        <p className="text-gray-400 text-xs mt-0.5 italic truncate">
          {event.visibleSegmentIds
            .slice(0, 2)
            .map(segmentLabel)
            .join(" · ")}
          {event.visibleSegmentIds.length > 2 &&
            ` +${event.visibleSegmentIds.length - 2}`}
        </p>
      </div>
    );
  }

  // selection
  return (
    <div className="rounded-lg border border-amber-600/40 bg-amber-500/10 px-3 py-2">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-amber-300 mb-1">
        <span>Selection</span>
        <span>{formatTime(event.time)}</span>
      </div>
      <blockquote className="border-l-2 border-amber-500/60 pl-2 text-gray-200 italic">
        {event.text}
      </blockquote>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
