/**
 * Notes mode keyword schema. Phrases are intentionally at least two
 * words — single common words like "important" or "highlight" fire too
 * often in normal speech and bury the user under highlights. Each
 * keyword has several alias phrasings; the `canonical` is what shows up
 * in the panel and substitutes into the transcript.
 */

import { KeywordPattern } from "../../utils/patmatch.js";
import type { KeywordDef } from "../types.js";

const HIGHLIGHT_COLORS = {
  highlight: "bg-yellow-500/30 text-yellow-100 border-yellow-500/60",
  dot: "bg-yellow-400",
} as const;

const BOOKMARK_COLORS = {
  highlight: "bg-blue-500/30 text-blue-100 border-blue-500/60",
  dot: "bg-blue-400",
} as const;

const TODO_COLORS = {
  highlight: "bg-green-500/30 text-green-100 border-green-500/60",
  dot: "bg-green-400",
} as const;

const IMPORTANT_COLORS = {
  highlight: "bg-red-500/30 text-red-100 border-red-500/60",
  dot: "bg-red-400",
} as const;

const NEXT_COLORS = {
  highlight: "bg-purple-500/30 text-purple-100 border-purple-500/60",
  dot: "bg-purple-400",
} as const;

export const NOTES_KEYWORDS: readonly KeywordDef[] = [
  {
    label: "highlight",
    canonical: "highlight that",
    description: "Mark a span as a highlight.",
    pattern: KeywordPattern.compile(`
      highlight (this | that | it)
      mark this
      mark that
    `),
    colorClasses: HIGHLIGHT_COLORS,
  },
  {
    label: "bookmark",
    canonical: "bookmark that",
    description: "Pin the spot in the transcript.",
    pattern: KeywordPattern.compile(`
      bookmark (this | that | it)
      save this spot
      pin this
      pin that
    `),
    colorClasses: BOOKMARK_COLORS,
  },
  {
    label: "todo",
    canonical: "action item",
    description: "Capture a follow-up.",
    pattern: KeywordPattern.compile(`
      action item
      to do item
      todo item
      follow up on (this | that)
      make a note
    `),
    colorClasses: TODO_COLORS,
  },
  {
    label: "important",
    canonical: "this is important",
    description: "Flag something important.",
    pattern: KeywordPattern.compile(`
      this is important
      that is important
      really important
      mark important
      flag important
    `),
    colorClasses: IMPORTANT_COLORS,
  },
  {
    label: "next",
    canonical: "next topic",
    description: "Move forward to the next topic / slide / section.",
    pattern: KeywordPattern.compile("next (topic | slide | section | item)"),
    colorClasses: NEXT_COLORS,
  },
];
