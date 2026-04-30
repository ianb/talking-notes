import { useEffect, useState } from "react";

export interface PendingSelection {
  segmentId: string;
  text: string;
  /** Viewport rect of the selection, for positioning the add button. */
  rect: DOMRect;
}

/**
 * Watches the window text selection. When the user selects text inside
 * a [data-segment-id] element, sets a PendingSelection that callers can
 * surface as a floating "+" button. Nothing is emitted automatically —
 * the user decides what goes into the feed.
 */
export function useSelectionTracker(enabled: boolean): {
  selection: PendingSelection | null;
  clear: () => void;
} {
  // Internal state is preserved across enable toggles, but `selection`
  // returned to callers is gated by `enabled` so disabling acts like a
  // clear without needing a setState in an effect.
  const [internalSel, setInternalSel] = useState<PendingSelection | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    function handleChange() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
          setInternalSel(null);
          return;
        }
        let node: Node | null = sel.anchorNode;
        while (node && node !== document.body) {
          if (node instanceof HTMLElement && node.dataset.segmentId) {
            const range = sel.getRangeAt(0);
            setInternalSel({
              segmentId: node.dataset.segmentId,
              text: sel.toString().trim(),
              rect: range.getBoundingClientRect(),
            });
            return;
          }
          node = node.parentNode;
        }
        setInternalSel(null);
      }, 300);
    }

    document.addEventListener("selectionchange", handleChange);
    return () => {
      document.removeEventListener("selectionchange", handleChange);
      if (timer) clearTimeout(timer);
    };
  }, [enabled]);

  function clear() {
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
    setInternalSel(null);
  }

  return { selection: enabled ? internalSel : null, clear };
}
