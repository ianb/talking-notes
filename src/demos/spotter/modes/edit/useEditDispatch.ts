/**
 * Hook that dispatches an LLM edit call for the currently-pending edit
 * block and reports the result back through the supplied state setters.
 *
 * The earlier inline version returned an abort cleanup whose deps
 * included the `pendingEdit` object itself — and because that object's
 * identity changes on every transcript delta even when its `.key` is
 * stable, the cleanup ran several times a second and never let the
 * fetch complete. This hook keys the dispatch effect on `pendingKey`
 * alone, reads the current block via a ref, and aborts only when the
 * key changes or on unmount.
 *
 * Callers pass their `setAppliedEdits` and `setEditError` setters
 * directly. React state setters are stable across renders, so the
 * effect deps stay clean without the caller having to wrap them in
 * `useCallback`.
 */

import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { applyLlmEdit, describeLlmEditError } from "./llmEdit.js";
import type { PendingEdit } from "./deriveDraft.js";

interface UseEditDispatchArgs {
  pendingKey: string | null;
  pendingEdit: PendingEdit | null;
  openai: string | null;
  keyMissing: boolean;
  setAppliedEdits: Dispatch<SetStateAction<Map<string, string>>>;
  setEditError: Dispatch<SetStateAction<string | null>>;
}

interface Inflight {
  key: string;
  controller: AbortController;
}

export function useEditDispatch({
  pendingKey,
  pendingEdit,
  openai,
  keyMissing,
  setAppliedEdits,
  setEditError,
}: UseEditDispatchArgs): void {
  const pendingEditRef = useRef<PendingEdit | null>(pendingEdit);
  useEffect(() => {
    pendingEditRef.current = pendingEdit;
  });

  const inflightRef = useRef<Inflight | null>(null);

  useEffect(() => {
    const inflight = inflightRef.current;
    if (inflight !== null && inflight.key !== pendingKey) {
      inflight.controller.abort();
      inflightRef.current = null;
    }
    if (pendingKey === null) return;
    if (keyMissing) return;
    const already = inflightRef.current;
    if (already !== null && already.key === pendingKey) return;
    const block = pendingEditRef.current;
    if (block === null || block.key !== pendingKey) return;
    const apiKey = openai === null ? "" : openai;
    const controller = new AbortController();
    inflightRef.current = { key: pendingKey, controller };
    applyLlmEdit({
      apiKey,
      draft: block.draftBefore,
      instructions: block.instructions,
      signal: controller.signal,
    })
      .then((result) => {
        clearInflight(inflightRef, controller);
        setAppliedEdits((prev) => {
          if (prev.has(block.key)) return prev;
          const next = new Map(prev);
          next.set(block.key, result);
          return next;
        });
        setEditError(null);
      })
      .catch((e: unknown) => {
        clearInflight(inflightRef, controller);
        if (e instanceof DOMException && e.name === "AbortError") return;
        setEditError(describeLlmEditError(e));
        // Fall back to the unedited draft so the walker can move past
        // this block on the next render.
        setAppliedEdits((prev) => {
          if (prev.has(block.key)) return prev;
          const next = new Map(prev);
          next.set(block.key, block.draftBefore);
          return next;
        });
      });
  }, [pendingKey, openai, keyMissing, setAppliedEdits, setEditError]);

  useEffect(
    () => () => {
      if (inflightRef.current !== null) {
        inflightRef.current.controller.abort();
        inflightRef.current = null;
      }
    },
    [],
  );
}

function clearInflight(
  ref: { current: Inflight | null },
  controller: AbortController,
) {
  if (ref.current !== null && ref.current.controller === controller) {
    ref.current = null;
  }
}
