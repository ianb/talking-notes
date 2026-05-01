/**
 * Trigger phrases for the language-learning demo.
 *
 * These are intentionally single-word — `question` and `send` — even
 * though the spotter feedback memo says default to two-word triggers.
 * The user speaks primarily in Spanish, so isolated English words are
 * unlikely to fire spuriously in normal speech. If the user code-switches
 * enough for this to become noisy, broaden these to two-word phrases
 * (e.g. `start question` / `send question`) before adding more aliases.
 */

import { KeywordPattern } from "../spotter/utils/patmatch.js";

export const QUESTION_PATTERN = KeywordPattern.compile("question");
export const SEND_PATTERN = KeywordPattern.compile("send");
