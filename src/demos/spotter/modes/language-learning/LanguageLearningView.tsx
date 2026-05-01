/**
 * Language-learning mode view. Mounts below the spotter shell's shared
 * transcript pane and renders a chronological log of Q&A pairs and
 * critiques.
 *
 * The shell hands us the full match list; we filter to this mode's own
 * matches (modeId === "language-learning") and split by label to drive
 * `deriveQaState` and `deriveCritiqueCalls`. Async LLM results live in
 * two state maps — one per kind — populated by the dispatch hooks.
 *
 * `modeStartIndex` from the shell anchors what counts as "this
 * session": matches before that index belong to a previous activation
 * of the mode and are ignored here.
 */

import { useMemo, useState } from "react";
import { useApiKeys } from "../../../../apiKeys.js";
import type { ModeMatch, ModeViewProps } from "../types.js";
import {
  deriveCritiqueCalls,
  deriveQaState,
  type KeywordHit,
} from "./deriveState.js";
import {
  useAnswerDispatch,
  type AnswerEntry,
} from "./useAnswerDispatch.js";
import {
  useCritiqueDispatch,
  type CritiqueEntry,
} from "./useCritiqueDispatch.js";
import { LogList, PendingChip } from "./components/LogList.js";

const MODE_ID = "language-learning";

interface LabeledHits {
  question: KeywordHit[];
  send: KeywordHit[];
  critique: KeywordHit[];
}

function partitionHits(
  matches: readonly ModeMatch[],
  modeStartIndex: number,
): LabeledHits {
  const out: LabeledHits = { question: [], send: [], critique: [] };
  for (const m of matches) {
    if (m.modeId !== MODE_ID) continue;
    if (m.start < modeStartIndex) continue;
    if (m.label === "question") {
      out.question.push({ start: m.start, end: m.end });
    } else if (m.label === "send") {
      out.send.push({ start: m.start, end: m.end });
    } else if (m.label === "critique") {
      out.critique.push({ start: m.start, end: m.end });
    }
  }
  return out;
}

export function LanguageLearningView({
  transcript,
  matches,
  modeStartIndex,
}: ModeViewProps) {
  const { openai } = useApiKeys();
  const [answers, setAnswers] = useState<Map<string, AnswerEntry>>(
    () => new Map(),
  );
  const [critiques, setCritiques] = useState<Map<string, CritiqueEntry>>(
    () => new Map(),
  );

  const hits = useMemo(
    () => partitionHits(matches, modeStartIndex),
    [matches, modeStartIndex],
  );

  const qa = useMemo(
    () =>
      deriveQaState({
        transcript,
        questionHits: hits.question,
        sendHits: hits.send,
      }),
    [transcript, hits.question, hits.send],
  );

  const critiqueCalls = useMemo(
    () =>
      deriveCritiqueCalls({
        transcript,
        questionHits: hits.question,
        sendHits: hits.send,
        critiqueHits: hits.critique,
        modeStartIndex,
      }),
    [transcript, hits.question, hits.send, hits.critique, modeStartIndex],
  );

  useAnswerDispatch({
    qaCalls: qa.qaCalls,
    answers,
    openai,
    setAnswers,
  });

  useCritiqueDispatch({
    critiqueCalls,
    critiques,
    openai,
    setCritiques,
  });

  const openaiMissing = openai === null || openai.length === 0;
  const hasWork =
    qa.qaCalls.length > 0 ||
    critiqueCalls.length > 0 ||
    qa.pendingQuestion !== null;

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-3 border-b border-gray-800 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
          Language log
        </h2>
        <span className="text-xs text-gray-500">Spanish</span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <LogList
          qaCalls={qa.qaCalls}
          critiqueCalls={critiqueCalls}
          answers={answers}
          critiques={critiques}
          openaiMissing={openaiMissing}
        />
        {qa.pendingQuestion === null ? null : (
          <PendingChip pendingText={qa.pendingQuestion.transcribed} />
        )}
        {openaiMissing && hasWork ? (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
            Add an OpenAI API key on the home screen to get answers and
            critiques.
          </div>
        ) : null}
      </div>
    </div>
  );
}
