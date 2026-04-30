import { useMemo } from "react";
import type { KeywordMatch, KeywordLabel } from "../keywords.js";

interface TranscriptViewProps {
  transcript: string;
  matches: KeywordMatch[];
}

// Tailwind classnames for each keyword label. Kept inline so the
// JIT compiler picks them up — Tailwind does not detect class names
// constructed dynamically from non-literal strings.
const LABEL_CLASSES: Record<KeywordLabel, string> = {
  highlight: "bg-yellow-500/30 text-yellow-100 border-yellow-500/60",
  bookmark: "bg-blue-500/30 text-blue-100 border-blue-500/60",
  todo: "bg-green-500/30 text-green-100 border-green-500/60",
  important: "bg-red-500/30 text-red-100 border-red-500/60",
  next: "bg-purple-500/30 text-purple-100 border-purple-500/60",
};

interface Segment {
  key: string;
  text: string;
  match: KeywordMatch | null;
}

function segmentTranscript(
  transcript: string,
  matches: KeywordMatch[],
): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  for (const [i, m] of matches.entries()) {
    if (m.start > cursor) {
      segments.push({
        key: `plain-${cursor}`,
        text: transcript.slice(cursor, m.start),
        match: null,
      });
    }
    segments.push({
      key: `match-${i}-${m.start}`,
      text: transcript.slice(m.start, m.end),
      match: m,
    });
    cursor = m.end;
  }
  if (cursor < transcript.length) {
    segments.push({
      key: `plain-${cursor}`,
      text: transcript.slice(cursor),
      match: null,
    });
  }
  return segments;
}

export function TranscriptView({ transcript, matches }: TranscriptViewProps) {
  const segments = useMemo(
    () => segmentTranscript(transcript, matches),
    [transcript, matches],
  );

  if (!transcript) {
    return (
      <p className="text-gray-500 italic">
        Press start and begin speaking. Detected keywords will be highlighted
        as the transcript streams in.
      </p>
    );
  }

  return (
    <p className="text-lg leading-relaxed text-gray-100 whitespace-pre-wrap">
      {segments.map((seg) =>
        seg.match ? (
          <mark
            key={seg.key}
            className={`rounded px-1 border ${LABEL_CLASSES[seg.match.label]}`}
            title={seg.match.label}
          >
            {seg.text}
          </mark>
        ) : (
          <span key={seg.key}>{seg.text}</span>
        ),
      )}
    </p>
  );
}
