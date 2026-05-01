/**
 * Derive the edit-mode UI state from the immutable `(transcript, matches,
 * appliedEdits)` triple. Pure function — same inputs, same outputs.
 *
 * Why pure: we never want to "lose track of" what's been processed. By
 * recomputing from scratch on every render, we get correctness for free
 * — appending to the transcript, mid-stream LLM completions, even
 * scrubbing back through history all just work without per-event
 * bookkeeping. The cost is a re-walk per render, which is fine for
 * realistic transcript lengths.
 *
 * The trickiest piece is async edits. When the user closes an edit block
 * with "end edit", the LLM call may not have returned yet. We can't keep
 * walking forward past that point because the post-edit draft is
 * unknown — so the walker enters a "frozen" state, surfacing the
 * pending block to the caller. The caller fires the LLM, stores the
 * result in `appliedEdits`, and we re-derive — now the walker can move
 * past that block and continue with subsequent matches/text.
 */

import type { ModeMatch } from "../types.js";

/**
 * `kind: "edit"` — user said `start edit … end edit` and the captured
 * instructions describe the change to apply.
 *
 * `kind: "cleanup"` — user said `clean up text`; no user-supplied
 * instructions, the dispatch hook applies a hardcoded
 * voice-transcript-cleanup prompt to the current draft.
 */
export type PendingEdit =
  | {
      kind: "edit";
      /** Stable cache key — also used by the caller to dedupe LLM calls. */
      key: string;
      draftBefore: string;
      instructions: string;
    }
  | {
      kind: "cleanup";
      key: string;
      draftBefore: string;
    };

export interface DerivedDraftState {
  /** The final composed message, with any applied edits folded in. */
  draft: string;
  /** Non-null while inside a `start edit ... end edit` block. */
  editing: { instructions: string } | null;
  /**
   * The first edit block whose result isn't in `appliedEdits` yet. While
   * non-null, the walker is frozen and any text/matches after this block
   * are not yet reflected in `draft`.
   */
  pendingEdit: PendingEdit | null;
  /** Monotonic counters used by the view to fire transient animations. */
  counters: {
    sent: number;
    cleared: number;
    cancelled: number;
  };
  /** True iff a pending edit is blocking further processing. */
  frozen: boolean;
}

interface DeriveArgs {
  transcript: string;
  matches: ModeMatch[];
  appliedEdits: Map<string, string>;
  /** Char index where edit mode activated. Text before this is ignored. */
  modeStartIndex: number;
}

export function deriveDraftState({
  transcript,
  matches,
  appliedEdits,
  modeStartIndex,
}: DeriveArgs): DerivedDraftState {
  let draft = "";
  let editing: { startIdx: number; instructions: string } | null = null;
  let pendingEdit: PendingEdit | null = null;
  let frozen = false;
  const counters = { sent: 0, cleared: 0, cancelled: 0 };

  let cursor = modeStartIndex;

  for (const m of matches) {
    if (frozen) break;
    if (m.start < modeStartIndex) continue;
    // Only act on edit-mode keywords. Mode-switch matches (and any other
    // non-edit-mode match) are inert here — their plain-text neighbors
    // still flow through to the right buffer.
    if (m.modeId !== "edit") {
      const plain = transcript.slice(cursor, m.start);
      if (editing === null) {
        draft += plain;
      } else {
        editing.instructions += plain;
      }
      cursor = m.end;
      continue;
    }
    const plain = transcript.slice(cursor, m.start);

    if (m.label === "start-edit") {
      if (editing === null) {
        draft += plain;
        editing = { startIdx: m.end, instructions: "" };
      } else {
        // Already inside an edit; keep accumulating.
        editing.instructions += plain;
      }
    } else if (m.label === "end-edit") {
      if (editing !== null) {
        editing.instructions += plain;
        const key = `${editing.startIdx}-${m.start}`;
        const applied = appliedEdits.get(key);
        if (applied !== undefined) {
          draft = applied;
          editing = null;
        } else {
          pendingEdit = {
            kind: "edit",
            key,
            draftBefore: draft,
            instructions: editing.instructions.trim(),
          };
          frozen = true;
        }
      } else {
        draft += plain;
      }
    } else if (m.label === "clean-up-text") {
      if (editing === null) {
        draft += plain;
        const cleanup = resolveCleanup(m, { draft, appliedEdits });
        draft = cleanup.draft;
        pendingEdit = cleanup.pendingEdit;
        frozen = cleanup.frozen;
      } else {
        editing.instructions += plain;
      }
    } else if (m.label === "cancel-edit") {
      if (editing !== null) {
        editing = null;
      } else {
        draft += plain;
      }
    } else if (m.label === "send") {
      if (editing === null) {
        draft += plain;
        counters.sent += 1;
        draft = "";
      } else {
        editing.instructions += plain;
      }
    } else if (m.label === "clear") {
      if (editing === null) {
        counters.cleared += 1;
        draft = "";
      } else {
        editing.instructions += plain;
      }
    } else if (m.label === "cancel-message") {
      if (editing === null) {
        counters.cancelled += 1;
        draft = "";
      } else {
        editing.instructions += plain;
      }
    } else {
      // Unknown edit-mode label — defensive fallback, route the plain
      // text but otherwise treat the keyword as inert.
      if (editing === null) {
        draft += plain;
      } else {
        editing.instructions += plain;
      }
    }
    cursor = m.end;
  }

  if (!frozen) {
    const tail = transcript.slice(cursor);
    if (editing === null) {
      draft += tail;
    } else {
      editing.instructions += tail;
    }
  }

  return {
    draft,
    editing: editing === null ? null : { instructions: editing.instructions },
    pendingEdit,
    counters,
    frozen,
  };
}

interface CleanupResolution {
  draft: string;
  pendingEdit: PendingEdit | null;
  frozen: boolean;
}

/**
 * For a `clean up text` match: either return the cached cleaned draft
 * (turning the call into a no-op), or surface a cleanup pending edit
 * so the dispatch hook fires the LLM. Pulled out of `deriveDraftState`
 * to keep that function under the project's complexity limit.
 */
function resolveCleanup(
  m: ModeMatch,
  { draft, appliedEdits }: { draft: string; appliedEdits: Map<string, string> },
): CleanupResolution {
  const key = `cleanup-${m.start}-${m.end}`;
  const applied = appliedEdits.get(key);
  if (applied !== undefined) {
    return { draft: applied, pendingEdit: null, frozen: false };
  }
  return {
    draft,
    pendingEdit: { kind: "cleanup", key, draftBefore: draft },
    frozen: true,
  };
}
