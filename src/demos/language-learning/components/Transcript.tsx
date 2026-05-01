/**
 * Live-transcript renderer for language-learning. Plain Spanish text
 * passes through; `question` and `send` markers are highlighted with
 * distinct colors, and any text after a still-open `question` marker
 * (the pending question span) renders in sky-blue so the user can see
 * what's about to get sent to the LLM.
 */

import { useMemo } from "react";
import type { KeywordHit } from "../deriveState.js";

interface TranscriptProps {
  transcript: string;
  questionHits: readonly KeywordHit[];
  sendHits: readonly KeywordHit[];
  pendingStartIndex: number | null;
}

interface Span {
  key: string;
  text: string;
  kind: "plain" | "question-marker" | "send-marker" | "in-question";
}

function buildSpans({
  transcript,
  questionHits,
  sendHits,
  pendingStartIndex,
}: TranscriptProps): Span[] {
  if (transcript.length === 0) return [];
  const markersUnsorted = [
    ...questionHits.map((h) => ({ ...h, kind: "question-marker" as const })),
    ...sendHits.map((h) => ({ ...h, kind: "send-marker" as const })),
  ];
  const markers = markersUnsorted.toSorted((a, b) => a.start - b.start);

  const spans: Span[] = [];
  let cursor = 0;
  for (const [i, m] of markers.entries()) {
    if (m.start > cursor) {
      spans.push({
        key: `plain-${cursor}`,
        text: transcript.slice(cursor, m.start),
        kind:
          pendingStartIndex !== null && cursor >= pendingStartIndex
            ? "in-question"
            : "plain",
      });
    }
    spans.push({
      key: `marker-${i}-${m.start}`,
      text: transcript.slice(m.start, m.end),
      kind: m.kind,
    });
    cursor = m.end;
  }
  if (cursor < transcript.length) {
    spans.push({
      key: `plain-${cursor}`,
      text: transcript.slice(cursor),
      kind:
        pendingStartIndex !== null && cursor >= pendingStartIndex
          ? "in-question"
          : "plain",
    });
  }
  return spans;
}

export function Transcript(props: TranscriptProps) {
  const spans = useMemo(() => buildSpans(props), [props]);

  if (props.transcript.length === 0) {
    return (
      <p className="text-gray-500 italic">
        Press start and begin speaking. Bracket English questions with
        "question" and "send" to get an answer.
      </p>
    );
  }

  return (
    <p className="text-base leading-relaxed text-gray-100 whitespace-pre-wrap">
      {spans.map((s) => {
        if (s.kind === "plain") return <span key={s.key}>{s.text}</span>;
        if (s.kind === "in-question") {
          return (
            <span key={s.key} className="text-sky-300">
              {s.text}
            </span>
          );
        }
        const cls =
          s.kind === "question-marker"
            ? "bg-sky-500/30 text-sky-100 border-sky-500/60"
            : "bg-emerald-500/30 text-emerald-100 border-emerald-500/60";
        return (
          <mark key={s.key} className={`rounded px-1 border ${cls}`}>
            {s.text}
          </mark>
        );
      })}
    </p>
  );
}
