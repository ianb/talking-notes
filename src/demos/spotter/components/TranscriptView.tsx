/**
 * Render the live transcript with each spotted keyword shown as its
 * canonical form. The literal text the user said still defines the span
 * (so highlights and counts line up with what was actually heard) but
 * the rendered text is the canonical phrase from the keyword definition,
 * giving aliases like "begin edit" and "start edit" a single visual
 * surface.
 *
 * `interim` is the live, not-yet-final tail of the current utterance
 * (Deepgram only — Voxtral leaves it empty). It renders right after
 * the committed transcript with reduced opacity so the user can see
 * speech as it's recognized; its highlights are decorative and do
 * **not** drive any keyword actions in mode views.
 */

import { useMemo, type ReactNode } from "react";
import type { ModeMatch } from "../modes/types.js";

interface TranscriptViewProps {
  transcript: string;
  matches: ModeMatch[];
  interim?: string;
  interimMatches?: ModeMatch[];
}

interface Segment {
  key: string;
  text: string;
  match: ModeMatch | null;
}

function segmentText(text: string, matches: ModeMatch[]): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  for (const [i, m] of matches.entries()) {
    if (m.start > cursor) {
      segments.push({
        key: `plain-${cursor}`,
        text: text.slice(cursor, m.start),
        match: null,
      });
    }
    segments.push({
      key: `match-${i}-${m.start}`,
      text: text.slice(m.start, m.end),
      match: m,
    });
    cursor = m.end;
  }
  if (cursor < text.length) {
    segments.push({
      key: `plain-${cursor}`,
      text: text.slice(cursor),
      match: null,
    });
  }
  return segments;
}

function renderSegment(seg: Segment, prefix: string): ReactNode {
  if (seg.match === null) {
    return <span key={`${prefix}-${seg.key}`}>{seg.text}</span>;
  }
  return (
    <mark
      key={`${prefix}-${seg.key}`}
      className={`rounded px-1 border ${seg.match.colorClasses.highlight}`}
      title={`${seg.match.canonical} (heard: "${seg.text.trim()}")`}
    >
      {seg.match.canonical}
    </mark>
  );
}

export function TranscriptView({
  transcript,
  matches,
  interim,
  interimMatches,
}: TranscriptViewProps) {
  const committedSegments = useMemo(
    () => segmentText(transcript, matches),
    [transcript, matches],
  );
  const interimSegments = useMemo(() => {
    const text = interim ?? "";
    if (text.length === 0) return [];
    return segmentText(text, interimMatches ?? []);
  }, [interim, interimMatches]);

  if (transcript.length === 0 && interimSegments.length === 0) {
    return (
      <p className="text-gray-500 italic">
        Press start and begin speaking. Detected keywords will be highlighted
        as the transcript streams in.
      </p>
    );
  }

  return (
    <p className="text-base leading-relaxed text-gray-100 whitespace-pre-wrap">
      {committedSegments.map((s) => renderSegment(s, "c"))}
      {interimSegments.length === 0 ? null : (
        <span className="opacity-60 italic">
          {transcript.length > 0 && !transcript.endsWith(" ") ? " " : null}
          {interimSegments.map((s) => renderSegment(s, "i"))}
        </span>
      )}
    </p>
  );
}
