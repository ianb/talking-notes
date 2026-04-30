/**
 * Run a flat list of keyword definitions against a transcript and return
 * a sorted, de-overlapped sequence of `ModeMatch`es.
 *
 * "De-overlapped" means: when two patterns match overlapping spans, the
 * one that started earlier wins; ties are broken by the longer match.
 * This keeps the highlighter from emitting nested spans and keeps any
 * per-match counters honest.
 *
 * Both regular keywords and mode-switch meta keywords run through the
 * same pass — callers tell them apart by `match.modeId === META_MODE_ID`
 * (or by reading `match.targetModeId`).
 */

import {
  META_MODE_ID,
  type KeywordDef,
  type ModeMatch,
  type ModeSwitchKeyword,
} from "./types.js";

interface FindMatchesArgs {
  modeKeywords: readonly KeywordDef[];
  modeId: string;
  switchKeywords: readonly ModeSwitchKeyword[];
}

export function findMatches(
  transcript: string,
  { modeKeywords, modeId, switchKeywords }: FindMatchesArgs,
): ModeMatch[] {
  if (!transcript.trim()) return [];

  const all: ModeMatch[] = [];

  for (const def of modeKeywords) {
    const matches = def.pattern.matchAll(transcript);
    for (const m of matches) {
      const range = m.range;
      if (range.end <= range.start) continue;
      all.push({
        modeId,
        label: def.label,
        canonical: def.canonical,
        start: range.start,
        end: range.end,
        text: transcript.slice(range.start, range.end),
        tags: m.tags,
        colorClasses: def.colorClasses,
        targetModeId: null,
      });
    }
  }

  for (const sw of switchKeywords) {
    const matches = sw.pattern.matchAll(transcript);
    for (const m of matches) {
      const range = m.range;
      if (range.end <= range.start) continue;
      all.push({
        modeId: META_MODE_ID,
        label: `switch-to-${sw.targetModeId}`,
        canonical: sw.canonical,
        start: range.start,
        end: range.end,
        text: transcript.slice(range.start, range.end),
        tags: m.tags,
        colorClasses: sw.colorClasses,
        targetModeId: sw.targetModeId,
      });
    }
  }

  all.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - a.end;
  });

  const resolved: ModeMatch[] = [];
  let cursor = 0;
  for (const m of all) {
    if (m.start < cursor) continue;
    resolved.push(m);
    cursor = m.end;
  }
  return resolved;
}
