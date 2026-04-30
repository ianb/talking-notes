import { useEffect, useRef } from "react";

interface UseScrollTrackerOptions {
  enabled: boolean;
  readingStartTime: number;
  onScroll: (visibleSegmentIds: string[], time: number) => void;
}

/**
 * Tracks which [data-segment-id] elements are in the viewport. Emits an
 * event (throttled to ~1s) when the visible set actually changes.
 * Dropping redundant scrolls that had no intervening speech is the
 * reducer's job.
 */
export function useScrollTracker({
  enabled,
  readingStartTime,
  onScroll,
}: UseScrollTrackerOptions) {
  const onScrollRef = useRef(onScroll);
  const lastKeyRef = useRef<string>("");

  useEffect(() => {
    onScrollRef.current = onScroll;
  });

  useEffect(() => {
    if (!enabled) return;

    function checkVisible() {
      const segments = document.querySelectorAll("[data-segment-id]");
      const visible: string[] = [];
      for (const el of segments) {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          visible.push(el.getAttribute("data-segment-id")!);
        }
      }
      const key = visible.join(",");
      if (key !== lastKeyRef.current && visible.length > 0) {
        lastKeyRef.current = key;
        onScrollRef.current(visible, Date.now() - readingStartTime);
      }
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    function handleScroll() {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        checkVisible();
      }, 1000);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    checkVisible();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (timer) clearTimeout(timer);
    };
  }, [enabled, readingStartTime]);
}
