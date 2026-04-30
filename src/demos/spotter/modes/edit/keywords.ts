/**
 * Edit mode keyword schema. Two clusters of keywords:
 *
 *  - Message lifecycle: send / clear / cancel. These are visual-only in
 *    the demo — they pop up an animation but don't actually transmit
 *    anything anywhere.
 *  - Edit blocks: `start edit ... end edit` brackets a region of speech
 *    that's interpreted as instructions for an LLM to apply against the
 *    current draft. `cancel edit` aborts a pending block.
 *
 * Aliases are encoded as multi-line patterns (each line is its own
 * alternative). The first line of each pattern doesn't get any special
 * status — the canonical form lives on the `canonical` field, displayed
 * in the keyword panel and substituted into the transcript when the
 * pattern matches.
 */

import { KeywordPattern } from "../../utils/patmatch.js";
import type { KeywordDef } from "../types.js";

const COLORS_SEND = {
  highlight: "bg-emerald-500/30 text-emerald-100 border-emerald-500/60",
  dot: "bg-emerald-400",
} as const;

const COLORS_CLEAR = {
  highlight: "bg-slate-500/30 text-slate-100 border-slate-500/60",
  dot: "bg-slate-400",
} as const;

const COLORS_CANCEL = {
  highlight: "bg-rose-500/30 text-rose-100 border-rose-500/60",
  dot: "bg-rose-400",
} as const;

const COLORS_START_EDIT = {
  highlight: "bg-amber-500/30 text-amber-100 border-amber-500/60",
  dot: "bg-amber-400",
} as const;

const COLORS_END_EDIT = {
  highlight: "bg-blue-500/30 text-blue-100 border-blue-500/60",
  dot: "bg-blue-400",
} as const;

const COLORS_CANCEL_EDIT = {
  highlight: "bg-zinc-500/30 text-zinc-100 border-zinc-500/60",
  dot: "bg-zinc-400",
} as const;

export const EDIT_KEYWORDS: readonly KeywordDef[] = [
  {
    label: "send",
    canonical: "send message",
    description: "Send the composed message (visual only).",
    pattern: KeywordPattern.compile(`
      send message
      send the message
      send it
    `),
    colorClasses: COLORS_SEND,
  },
  {
    label: "clear",
    canonical: "clear message",
    description: "Wipe the draft and start over.",
    pattern: KeywordPattern.compile(`
      clear message
      clear the message
      clear draft
      reset message
      discard message
    `),
    colorClasses: COLORS_CLEAR,
  },
  {
    label: "cancel-message",
    canonical: "cancel message",
    description: "Abandon the draft (visual only).",
    pattern: KeywordPattern.compile(`
      cancel message
      cancel the message
      cancel this message
    `),
    colorClasses: COLORS_CANCEL,
  },
  {
    label: "start-edit",
    canonical: "start edit",
    description:
      "Begin an edit instruction. Speak the change you want, then say 'end edit'.",
    pattern: KeywordPattern.compile(`
      start edit
      begin edit
      open edit
    `),
    colorClasses: COLORS_START_EDIT,
  },
  {
    label: "end-edit",
    canonical: "end edit",
    description: "Apply the spoken instructions to the draft via the LLM.",
    pattern: KeywordPattern.compile(`
      end edit
      finish edit
      apply edit
      done editing
    `),
    colorClasses: COLORS_END_EDIT,
  },
  {
    label: "cancel-edit",
    canonical: "cancel edit",
    description: "Discard the in-progress edit instructions.",
    pattern: KeywordPattern.compile(`
      cancel edit
      abort edit
      nevermind edit
    `),
    colorClasses: COLORS_CANCEL_EDIT,
  },
];
