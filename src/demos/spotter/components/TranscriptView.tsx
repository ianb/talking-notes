/**
 * Render the live transcript with each spotted keyword shown as its
 * canonical form. The literal text the user said still defines the span
 * (so highlights and counts line up with what was actually heard) but
 * the rendered text is the canonical phrase from the keyword definition,
 * giving aliases like "begin edit" and "start edit" a single visual
 * surface.
 */

import { useMemo } from "react";
import type { ModeMatch } from "../modes/types.js";

interface TranscriptViewProps {
  transcript: string;
  matches: ModeMatch[];
}

interface Segment {
  key: string;
  text: string;
  match: ModeMatch | null;
}

function segmentTranscript(transcript: string, matches: ModeMatch[]): Segment[] {
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

  if (transcript.length === 0) {
    return (
      <p className="text-gray-500 italic">
        Press start and begin speaking. Detected keywords will be highlighted
        as the transcript streams in.
      </p>
    );
  }

  return (
    <p className="text-base leading-relaxed text-gray-100 whitespace-pre-wrap">
      {segments.map((seg) =>
        seg.match === null ? (
          <span key={seg.key}>{seg.text}</span>
        ) : (
          <mark
            key={seg.key}
            className={`rounded px-1 border ${seg.match.colorClasses.highlight}`}
            title={`${seg.match.canonical} (heard: "${seg.text.trim()}")`}
          >
            {seg.match.canonical}
          </mark>
        ),
      )}
    </p>
  );
}
