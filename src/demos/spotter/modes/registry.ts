import type { ModeDef } from "./types.js";
import { NOTES_MODE } from "./notes/index.js";
import { EDIT_MODE } from "./edit/index.js";
import { LANGUAGE_LEARNING_MODE } from "./language-learning/index.js";

/**
 * Tuple type instead of plain array so the type system knows the list
 * is non-empty — `MODES[0]` is `ModeDef`, not `ModeDef | undefined`.
 */
export const MODES: readonly [ModeDef, ...ModeDef[]] = [
  NOTES_MODE,
  EDIT_MODE,
  LANGUAGE_LEARNING_MODE,
];

export const DEFAULT_MODE_ID = NOTES_MODE.id;

export function findMode(id: string): ModeDef | null {
  for (const mode of MODES) if (mode.id === id) return mode;
  return null;
}
