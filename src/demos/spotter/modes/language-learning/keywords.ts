/**
 * Language-learning mode keywords. The user speaks primarily in their
 * target language (Spanish) and uses these English markers to interject:
 *
 *   - `question` … `send` brackets a quick English question for the LLM
 *     to answer.
 *   - `critique this` requests a language critique of everything spoken
 *     so far in the session, minus the bracketed questions.
 *
 * Single-word triggers (`question`, `send`) deliberately deviate from
 * the project's two-word default — the user is speaking Spanish, so
 * isolated English words rarely fire spuriously. `critique this` is
 * already two words and matches the user's preferred phrasing.
 */

import { KeywordPattern } from "../../utils/patmatch.js";
import type { KeywordDef } from "../types.js";

const QUESTION_COLORS = {
  highlight: "bg-sky-500/30 text-sky-100 border-sky-500/60",
  dot: "bg-sky-400",
} as const;

const SEND_COLORS = {
  highlight: "bg-emerald-500/30 text-emerald-100 border-emerald-500/60",
  dot: "bg-emerald-400",
} as const;

const CRITIQUE_COLORS = {
  highlight: "bg-violet-500/30 text-violet-100 border-violet-500/60",
  dot: "bg-violet-400",
} as const;

export const LANGUAGE_LEARNING_KEYWORDS: readonly KeywordDef[] = [
  {
    label: "question",
    canonical: "question",
    description:
      "Open an English question. Speak the question, then say 'send'.",
    pattern: KeywordPattern.compile("question"),
    colorClasses: QUESTION_COLORS,
  },
  {
    label: "send",
    canonical: "send",
    description: "Close the question and ship it to the LLM.",
    pattern: KeywordPattern.compile("send"),
    colorClasses: SEND_COLORS,
  },
  {
    label: "critique",
    canonical: "critique this",
    description:
      "Take the Spanish you've spoken so far (minus any questions) and ask the LLM for feedback.",
    pattern: KeywordPattern.compile("critique (this | that | it)"),
    colorClasses: CRITIQUE_COLORS,
  },
];
