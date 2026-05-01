/**
 * Edit-mode view. Composes a "message" by dictation and uses bracketed
 * `start edit ... end edit` blocks to fire LLM-driven edits against the
 * current draft.
 *
 * Shape of the state:
 *
 *  - `appliedEdits`: a per-block cache of LLM results keyed by the
 *    block's char range in the transcript. Persistent across renders,
 *    populated only by completed LLM calls (in async .then handlers,
 *    not effect bodies). `deriveDraftState` reads this to decide
 *    whether each `start edit … end edit` block has resolved.
 *  - `editError`: surface for failed LLM calls. Same — populated in
 *    async .catch handlers.
 *  - Everything else (draft, in-progress instructions, "what was the
 *    most recent send/clear/cancel event") is *derived* purely from
 *    `(transcript, matches, modeStartIndex, appliedEdits)`. That
 *    avoids the setState-in-effect cascade pattern the linter rejects:
 *    when a new send match appears, we don't fire an effect — we just
 *    show the badge that the derive logic now points to, keyed by the
 *    match's end index so React remounts it on each new event.
 */

import { useMemo, useState } from "react";
import { useApiKeys } from "../../../../apiKeys.js";
import type { ModeMatch, ModeViewProps } from "../types.js";
import { deriveDraftState } from "./deriveDraft.js";
import { useEditDispatch } from "./useEditDispatch.js";

type AnimationKind = "send" | "clear" | "cancel";

const ANIMATION_LABELS: Record<AnimationKind, string> = {
  send: "Sent",
  clear: "Cleared",
  cancel: "Cancelled",
};

const ANIMATION_BG: Record<AnimationKind, string> = {
  send: "bg-emerald-500/20 border-emerald-500/50 text-emerald-100",
  clear: "bg-slate-500/20 border-slate-500/50 text-slate-100",
  cancel: "bg-rose-500/20 border-rose-500/50 text-rose-100",
};

interface MessageEvent {
  kind: AnimationKind;
  /** Stable React key — used so the badge remounts on each new event. */
  key: number;
}

const KEY_MISSING_MESSAGE = "OpenAI API key required to apply edits";

function findLatestMessageEvent(
  matches: ModeMatch[],
  modeStartIndex: number,
): MessageEvent | null {
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    if (!m) continue;
    if (m.modeId !== "edit") continue;
    if (m.start < modeStartIndex) continue;
    if (m.label === "send") return { kind: "send", key: m.end };
    if (m.label === "clear") return { kind: "clear", key: m.end };
    if (m.label === "cancel-message") return { kind: "cancel", key: m.end };
  }
  return null;
}

export function EditView({
  transcript,
  matches,
  modeStartIndex,
}: ModeViewProps) {
  const { openai } = useApiKeys();
  const [appliedEdits, setAppliedEdits] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [editError, setEditError] = useState<string | null>(null);

  const derived = useMemo(
    () =>
      deriveDraftState({
        transcript,
        matches,
        appliedEdits,
        modeStartIndex,
      }),
    [transcript, matches, appliedEdits, modeStartIndex],
  );

  const lastMessageEvent = useMemo(
    () => findLatestMessageEvent(matches, modeStartIndex),
    [matches, modeStartIndex],
  );

  const keyMissing = openai === null || openai.length === 0;
  const errorToShow =
    editError !== null
      ? editError
      : keyMissing && derived.pendingEdit !== null
        ? KEY_MISSING_MESSAGE
        : null;

  const pendingEdit = derived.pendingEdit;
  const pendingKey = pendingEdit === null ? null : pendingEdit.key;
  useEditDispatch({
    pendingKey,
    pendingEdit,
    openai,
    keyMissing,
    setAppliedEdits,
    setEditError,
  });

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
          Message draft
        </h2>
        {lastMessageEvent === null ? null : (
          <span
            key={lastMessageEvent.key}
            className={`text-xs px-3 py-1 rounded-full border ${ANIMATION_BG[lastMessageEvent.kind]}`}
          >
            {ANIMATION_LABELS[lastMessageEvent.kind]}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        <DraftCard
          draft={derived.draft}
          frozen={derived.frozen}
          editing={derived.editing}
        />

        {derived.editing === null ? null : (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
            <div className="text-xs uppercase tracking-wider text-amber-300 mb-1">
              Editing instruction
            </div>
            <div className="text-amber-100 whitespace-pre-wrap min-h-[1.5em]">
              {derived.editing.instructions.trim().length === 0
                ? "(speak the change you want, then say end edit)"
                : derived.editing.instructions}
            </div>
          </div>
        )}

        {derived.frozen ? (
          <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 p-4 text-sm text-blue-200 flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            {derived.pendingEdit !== null &&
            derived.pendingEdit.kind === "cleanup"
              ? "Cleaning up…"
              : "Applying edit…"}
          </div>
        ) : null}

        {errorToShow === null ? null : (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
            {errorToShow}
          </div>
        )}
      </div>
    </div>
  );
}

interface DraftCardProps {
  draft: string;
  frozen: boolean;
  editing: { instructions: string } | null;
}

function DraftCard({ draft, frozen, editing }: DraftCardProps) {
  const isEmpty = draft.trim().length === 0;
  const muted = frozen || editing !== null;
  return (
    <div
      className={`rounded-lg border bg-gray-900/60 p-5 transition-opacity ${
        muted ? "border-gray-700 opacity-70" : "border-gray-700"
      }`}
    >
      <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">
        Composing
      </div>
      {isEmpty ? (
        <p className="text-gray-600 italic">
          Start dictating. Say "send message" to send, "start edit … end edit"
          to rewrite via the LLM.
        </p>
      ) : (
        <p className="text-lg leading-relaxed text-gray-100 whitespace-pre-wrap">
          {draft}
        </p>
      )}
    </div>
  );
}
