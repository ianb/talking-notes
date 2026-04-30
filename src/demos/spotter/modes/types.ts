/**
 * Type surface shared by every spotter mode.
 *
 * A mode is a pluggable sub-experience that lives below the live
 * transcript: it declares a set of keyword phrases that should be spotted
 * in the transcript, plus a React view that consumes the matches. The
 * shell aggregates every active mode's keywords (plus the always-on
 * mode-switch meta keywords) into a single match pass over the
 * transcript, and routes the matches back to the active mode.
 *
 * Aliases vs canonical: every keyword pattern accepts several phrasings
 * (e.g. "start edit" / "begin edit"), but each one has a single
 * `canonical` form that gets shown in the keyword panel and rendered in
 * place of the literal spoken text in the transcript.
 */

import type { ReactNode } from "react";
import type { KeywordPattern } from "../utils/patmatch.js";

export interface KeywordColorClasses {
  /**
   * Tailwind classes for the inline transcript highlight. Must be a
   * complete literal string that Tailwind's JIT can pick up — never
   * concatenate parts at runtime.
   */
  highlight: string;
  /** Tailwind class for the small dot in the keyword panel. */
  dot: string;
}

export interface KeywordDef {
  /** Mode-internal id. Stable across aliases. */
  label: string;
  /** Phrase shown in the keyword panel and substituted into the transcript. */
  canonical: string;
  /** Optional one-line description shown beneath the canonical phrase. */
  description: string | null;
  pattern: KeywordPattern;
  colorClasses: KeywordColorClasses;
}

/**
 * A meta keyword that triggers a mode switch when matched. The shell
 * intercepts these regardless of which mode is active.
 */
export interface ModeSwitchKeyword {
  targetModeId: string;
  canonical: string;
  pattern: KeywordPattern;
  colorClasses: KeywordColorClasses;
}

export interface ModeMatch {
  /** Mode that owns this keyword, or `META_MODE_ID` for mode-switch matches. */
  modeId: string;
  label: string;
  canonical: string;
  /** Inclusive char index of the first matched character in the transcript. */
  start: number;
  /** Exclusive char index — `transcript.slice(start, end)` is the literal text. */
  end: number;
  text: string;
  tags: Record<string, string>;
  colorClasses: KeywordColorClasses;
  /** Set on mode-switch matches; null otherwise. */
  targetModeId: string | null;
}

export interface ModeViewProps {
  transcript: string;
  /** All matches over the full transcript, sorted and de-overlapped. */
  matches: ModeMatch[];
  /**
   * Char index at which this mode activated. Text and matches before
   * this index belong to a previous mode session and should be ignored
   * when deriving the mode's local state.
   */
  modeStartIndex: number;
}

export interface ModeDef {
  id: string;
  name: string;
  description: string;
  /**
   * Spoken phrases that name this mode. Used to build the meta
   * "enter <mode>" / "switch to <mode>" patterns. The first entry is the
   * canonical name and what the keyword panel will display.
   */
  spokenAliases: readonly string[];
  keywords: readonly KeywordDef[];
  View: (props: ModeViewProps) => ReactNode;
}

export const META_MODE_ID = "__meta__";
