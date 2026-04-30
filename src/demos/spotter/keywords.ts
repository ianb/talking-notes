/**
 * Filler keyword patterns for the spotter demo.
 *
 * These are placeholders — Ian will replace them with the real list. The
 * point is to exercise the matcher and the highlighting UI, so we pick a
 * handful of distinct phrases that are unlikely to overlap each other.
 *
 * Adding a new keyword: drop another entry in `KEYWORD_DEFS`. The label
 * shows up in the sidebar and styles the highlight color via the map in
 * SpotterApp.
 */

import { KeywordPattern, type InputMatch } from "./utils/patmatch.js";

export type KeywordLabel =
  | "highlight"
  | "bookmark"
  | "todo"
  | "important"
  | "next";

interface KeywordDef {
  label: KeywordLabel;
  pattern: KeywordPattern;
}

const KEYWORD_DEFS: KeywordDef[] = [
  {
    label: "highlight",
    pattern: KeywordPattern.compile(`
      highlight (this | that)?
    `),
  },
  {
    label: "bookmark",
    pattern: KeywordPattern.compile(`
      bookmark (this | that)?
    `),
  },
  {
    label: "todo",
    pattern: KeywordPattern.compile(`
      todo
      action item
    `),
  },
  {
    label: "important",
    pattern: KeywordPattern.compile(`
      important
      this is important
    `),
  },
  {
    label: "next",
    pattern: KeywordPattern.compile(`
      next (topic | slide | section)
    `),
  },
];

export interface KeywordMatch {
  label: KeywordLabel;
  start: number;
  end: number;
  text: string;
}

/**
 * Run every pattern against `transcript` and return non-overlapping
 * matches sorted by start position. When two matches overlap, the one
 * that started earlier wins; ties go to the longer match. This keeps the
 * highlighter from emitting nested spans and keeps the sidebar tally
 * aligned with what the user actually sees in the transcript.
 */
export function findKeywordMatches(transcript: string): KeywordMatch[] {
  const all: KeywordMatch[] = [];
  for (const def of KEYWORD_DEFS) {
    const matches: InputMatch[] = def.pattern.matchAll(transcript);
    for (const m of matches) {
      const range = m.range;
      if (range.end <= range.start) continue;
      all.push({
        label: def.label,
        start: range.start,
        end: range.end,
        text: transcript.slice(range.start, range.end),
      });
    }
  }
  all.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - a.end;
  });
  const resolved: KeywordMatch[] = [];
  let cursor = 0;
  for (const m of all) {
    if (m.start < cursor) continue;
    resolved.push(m);
    cursor = m.end;
  }
  return resolved;
}
