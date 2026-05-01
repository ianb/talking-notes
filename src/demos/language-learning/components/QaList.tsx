/**
 * Q&A log: one card per completed question/send bracket. Cards show
 * the cleaned question (if the LLM has answered) or the raw transcribed
 * span (while pending). Each card has a collapsible "Details" section
 * that shows the prompt we sent, the system prompt, and the raw JSON
 * response (or the error message) — useful for debugging when an
 * answer doesn't look right.
 *
 * The pending chip is rendered separately at the bottom of the
 * surrounding scroll area.
 */

import { useState } from "react";
import type { QaCall } from "../deriveState.js";
import { SYSTEM_PROMPT_LINES } from "../llmAnswer.js";
import type { AnswerEntry } from "../useAnswerDispatch.js";

interface QaListProps {
  qaCalls: QaCall[];
  answers: Map<string, AnswerEntry>;
  /** True when no OpenAI key is set; cards show a key-required note. */
  openaiMissing: boolean;
}

export function QaList({ qaCalls, answers, openaiMissing }: QaListProps) {
  if (qaCalls.length === 0) {
    return (
      <p className="text-gray-500 italic">
        No questions yet. Say "question … send" to ask one.
      </p>
    );
  }
  return (
    <ul className="space-y-4">
      {qaCalls.map((call) => (
        <QaCard
          key={call.id}
          call={call}
          entry={answers.get(call.id)}
          openaiMissing={openaiMissing}
        />
      ))}
    </ul>
  );
}

interface QaCardProps {
  call: QaCall;
  entry: AnswerEntry | undefined;
  openaiMissing: boolean;
}

function QaCard({ call, entry, openaiMissing }: QaCardProps) {
  const [expanded, setExpanded] = useState(false);
  const pending = entry === undefined;
  const errored = entry !== undefined && entry.status === "error";
  const data = entry !== undefined ? entry.data : null;
  const showKeyMissing = pending && openaiMissing;

  const displayQuestion =
    data === null ? call.transcribed : data.qa.question;
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
            <span className="text-amber-300 text-sm">
              OpenAI API key required — set one on the home screen.
            </span>
          ) : pending ? (
            <span className="text-gray-500 italic flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              Thinking…
            </span>
          ) : errored ? (
            <span className="text-red-300 text-sm">{entry.error}</span>
          ) : (
            displayAnswer
          )}
        </span>
      </div>
      <div className="px-5 py-2 border-t border-gray-800/50 bg-gray-950/40">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          {expanded ? "▾ Hide details" : "▸ Show details"}
        </button>
        {expanded ? (
          <CardDetails call={call} entry={entry} />
        ) : null}
      </div>
    </li>
  );
}

interface CardDetailsProps {
  call: QaCall;
  entry: AnswerEntry | undefined;
}

function CardDetails({ call, entry }: CardDetailsProps) {
  return (
    <div className="mt-2 space-y-3 text-xs text-gray-400">
      <DetailBlock label="System prompt">
        {SYSTEM_PROMPT_LINES.join("\n")}
      </DetailBlock>
      <DetailBlock label="User content (transcribed span)">
        {call.transcribed}
      </DetailBlock>
      <DetailBlock label="Status">
        {entry === undefined
          ? "pending"
          : entry.status === "ok"
            ? "ok"
            : "error"}
      </DetailBlock>
      {entry !== undefined && entry.data !== null ? (
        <DetailBlock label="Raw response">{entry.data.raw}</DetailBlock>
      ) : null}
      {entry !== undefined && entry.error !== null ? (
        <DetailBlock label="Error">{entry.error}</DetailBlock>
      ) : null}
    </div>
  );
}

interface DetailBlockProps {
  label: string;
  children: string;
}

function DetailBlock({ label, children }: DetailBlockProps) {
  return (
    <div>
      <div className="uppercase tracking-wider text-gray-600 mb-1">
        {label}
      </div>
      <pre className="whitespace-pre-wrap break-words font-mono text-gray-300 bg-black/30 rounded p-2 border border-gray-800">
        {children}
      </pre>
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
