/**
 * Unified Q&A + critique log for language-learning mode. Cards appear
 * in chronological order by their position in the transcript. Each
 * card type has its own shape but shares a common "Show details"
 * footer that reveals the prompt sent and the raw model response —
 * useful when an answer or critique looks off.
 */

import { useMemo, useState } from "react";
import type { CritiqueCall, QaCall } from "../deriveState.js";
import { SYSTEM_PROMPT_LINES } from "../llmAnswer.js";
import { CRITIQUE_SYSTEM_PROMPT_LINES } from "../llmCritique.js";
import type { AnswerEntry } from "../useAnswerDispatch.js";
import type { CritiqueEntry } from "../useCritiqueDispatch.js";

interface LogListProps {
  qaCalls: QaCall[];
  critiqueCalls: CritiqueCall[];
  answers: Map<string, AnswerEntry>;
  critiques: Map<string, CritiqueEntry>;
  openaiMissing: boolean;
}

interface QaEntry {
  kind: "qa";
  position: number;
  call: QaCall;
}

interface CritEntry {
  kind: "critique";
  position: number;
  call: CritiqueCall;
}

type LogEntry = QaEntry | CritEntry;

export function LogList({
  qaCalls,
  critiqueCalls,
  answers,
  critiques,
  openaiMissing,
}: LogListProps) {
  const entries = useMemo<LogEntry[]>(() => {
    const list: LogEntry[] = [];
    for (const c of qaCalls) {
      list.push({ kind: "qa", position: c.startIndex, call: c });
    }
    for (const c of critiqueCalls) {
      list.push({ kind: "critique", position: c.position, call: c });
    }
    return list.toSorted((a, b) => a.position - b.position);
  }, [qaCalls, critiqueCalls]);

  if (entries.length === 0) {
    return (
      <p className="text-gray-500 italic">
        Nothing yet. Say "question … send" to ask a question, or
        "critique this" for feedback.
      </p>
    );
  }
  return (
    <ul className="space-y-4">
      {entries.map((e) =>
        e.kind === "qa" ? (
          <QaCard
            key={e.call.id}
            call={e.call}
            entry={answers.get(e.call.id)}
            openaiMissing={openaiMissing}
          />
        ) : (
          <CritiqueCard
            key={e.call.id}
            call={e.call}
            entry={critiques.get(e.call.id)}
            openaiMissing={openaiMissing}
          />
        ),
      )}
    </ul>
  );
}

interface QaCardProps {
  call: QaCall;
  entry: AnswerEntry | undefined;
  openaiMissing: boolean;
}

function QaCard({ call, entry, openaiMissing }: QaCardProps) {
  const pending = entry === undefined;
  const errored = entry !== undefined && entry.status === "error";
  const data = entry !== undefined ? entry.data : null;
  const showKeyMissing = pending && openaiMissing;
  const displayQuestion = data === null ? call.transcribed : data.qa.question;
  const displayAnswer = data === null ? null : data.qa.answer;

  return (
    <li className="rounded-lg border border-gray-800 bg-gray-900/50 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-800 flex items-baseline gap-3">
        <span className="text-xs uppercase tracking-wider text-sky-400 font-semibold">
          Q
        </span>
        <span className="text-gray-100 flex-1">{displayQuestion}</span>
      </div>
      <div className="px-5 py-3 flex items-baseline gap-3">
        <span className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">
          A
        </span>
        <span className="flex-1 text-gray-100">
          {showKeyMissing ? (
            <KeyMissing />
          ) : pending ? (
            <Thinking />
          ) : errored ? (
            <span className="text-red-300 text-sm">{entry.error}</span>
          ) : (
            displayAnswer
          )}
        </span>
      </div>
      <ExpandableDetails
        rows={[
          { label: "System prompt", value: SYSTEM_PROMPT_LINES.join("\n") },
          { label: "User content (transcribed span)", value: call.transcribed },
          {
            label: "Status",
            value:
              entry === undefined
                ? "pending"
                : entry.status === "ok"
                  ? "ok"
                  : "error",
          },
          ...(entry !== undefined && entry.data !== null
            ? [{ label: "Raw response", value: entry.data.raw }]
            : []),
          ...(entry !== undefined && entry.error !== null
            ? [{ label: "Error", value: entry.error }]
            : []),
        ]}
      />
    </li>
  );
}

interface CritiqueCardProps {
  call: CritiqueCall;
  entry: CritiqueEntry | undefined;
  openaiMissing: boolean;
}

function CritiqueCard({ call, entry, openaiMissing }: CritiqueCardProps) {
  const pending = entry === undefined;
  const errored = entry !== undefined && entry.status === "error";
  const data = entry !== undefined ? entry.data : null;
  const showKeyMissing = pending && openaiMissing;

  return (
    <li className="rounded-lg border border-violet-700/40 bg-violet-950/30 overflow-hidden">
      <div className="px-5 py-3 border-b border-violet-800/40 flex items-baseline gap-3">
        <span className="text-xs uppercase tracking-wider text-violet-400 font-semibold">
          Sample
        </span>
        <span className="text-gray-100 flex-1 italic">
          {call.spanishContent}
        </span>
      </div>
      <div className="px-5 py-3 flex items-baseline gap-3">
        <span className="text-xs uppercase tracking-wider text-violet-300 font-semibold">
          Critique
        </span>
        <span className="flex-1 text-gray-100 whitespace-pre-wrap">
          {showKeyMissing ? (
            <KeyMissing />
          ) : pending ? (
            <Thinking />
          ) : errored ? (
            <span className="text-red-300 text-sm">{entry.error}</span>
          ) : data === null ? null : (
            data.critique
          )}
        </span>
      </div>
      <ExpandableDetails
        rows={[
          {
            label: "System prompt",
            value: CRITIQUE_SYSTEM_PROMPT_LINES.join("\n"),
          },
          { label: "User content (Spanish sample)", value: call.spanishContent },
          {
            label: "Status",
            value:
              entry === undefined
                ? "pending"
                : entry.status === "ok"
                  ? "ok"
                  : "error",
          },
          ...(entry !== undefined && entry.data !== null
            ? [{ label: "Raw response", value: entry.data.raw }]
            : []),
          ...(entry !== undefined && entry.error !== null
            ? [{ label: "Error", value: entry.error }]
            : []),
        ]}
      />
    </li>
  );
}

function Thinking() {
  return (
    <span className="text-gray-500 italic flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
      Thinking…
    </span>
  );
}

function KeyMissing() {
  return (
    <span className="text-amber-300 text-sm">
      OpenAI API key required — set one on the home screen.
    </span>
  );
}

interface DetailsProps {
  rows: { label: string; value: string }[];
}

function ExpandableDetails({ rows }: DetailsProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="px-5 py-2 border-t border-gray-800/50 bg-gray-950/40">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        {expanded ? "▾ Hide details" : "▸ Show details"}
      </button>
      {expanded ? (
        <div className="mt-2 space-y-3 text-xs text-gray-400">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="uppercase tracking-wider text-gray-600 mb-1">
                {r.label}
              </div>
              <pre className="whitespace-pre-wrap break-words font-mono text-gray-300 bg-black/30 rounded p-2 border border-gray-800">
                {r.value}
              </pre>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface PendingChipProps {
  pendingText: string;
}

export function PendingChip({ pendingText }: PendingChipProps) {
  return (
    <div className="mt-4 sticky bottom-0 rounded-lg border border-sky-500/40 bg-sky-500/10 backdrop-blur-sm px-5 py-3 flex items-center gap-3">
      <span className="text-xs uppercase tracking-wider text-sky-300 font-semibold">
        Asking…
      </span>
      <span className="text-sky-100 flex-1 truncate">
        {pendingText.length === 0
          ? "(say your question, then 'send')"
          : pendingText}
      </span>
    </div>
  );
}
