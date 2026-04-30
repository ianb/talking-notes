/**
 * Keyword pattern matching library, ported from callback-box.
 *
 * Patterns look like:
 *
 *   "(a | the) test"
 *
 * Which matches "a test", "the test", "the test!", etc.
 *
 * Pattern syntax:
 *
 *   1. Sequence of words: "a b c"
 *   2. Alternatives: "a|b" (two-word shortcut) or "(a | b | c)"
 *   3. Multi-word groups: "(some day | today)"
 *   4. Optional: "a?", "(a | b)?", or implicitly "(a | b | )"
 *   5. Multiple lines act as alternatives between phrases
 *   6. Tags before a phrase: "[name=value] some words"
 *
 * Words are matched in normalized form — lowercased, NFKD-decomposed,
 * diacritics and punctuation stripped — so "café" matches "cafe", and
 * "Hello!" matches "hello".
 *
 * Input is tokenized into words that retain their original surface
 * (`leading + original + trailing` reproduces the input exactly), so
 * `InputMatch` can rebuild the transcript with the matched span replaced
 * (`replace`/`replaceTrimmed`) or report its character range (`range`).
 *
 * The implementation is split across three files to satisfy the project's
 * 300-line limit: this file (the public surface), `patmatch-internals.ts`
 * (matcher classes + types), and `patmatch-compile.ts` (tokenizer +
 * compiler).
 */

import { type Matcher, type InputWord } from "./patmatch-internals.js";
import { tokenizeInput, compilePattern } from "./patmatch-compile.js";

export { KeywordPatternError } from "./patmatch-internals.js";

export interface MatchRange {
  start: number;
  end: number;
}

interface InputMatchInit {
  leading: InputWord[];
  captured: InputWord[];
  remaining: InputWord[];
  tags: Record<string, string>;
}

export class InputMatch {
  leading: InputWord[];
  captured: InputWord[];
  remaining: InputWord[];
  tags: Record<string, string>;

  constructor({ leading, captured, remaining, tags }: InputMatchInit) {
    this.leading = leading;
    this.captured = captured;
    this.remaining = remaining;
    this.tags = tags;
  }

  static joinInput(words: InputWord[]) {
    return words.map((w) => `${w.leading}${w.original}${w.trailing}`).join("");
  }

  get capturedText() {
    return InputMatch.joinInput(this.captured);
  }

  get capturedTextTrimmed() {
    return InputMatch.joinInput(this.captured).trim();
  }

  /**
   * Character range of the trimmed captured phrase within the original
   * input. Useful for highlighting: render `input.slice(start, end)` as
   * the matched span.
   */
  get range(): MatchRange {
    const leadingText = InputMatch.joinInput(this.leading);
    const captured = this.capturedText;
    const leadingWsMatch = captured.match(/^\s*/);
    const trailingWsMatch = captured.match(/\s*$/);
    const leadingWs = leadingWsMatch ? leadingWsMatch[0].length : 0;
    const trailingWs = trailingWsMatch ? trailingWsMatch[0].length : 0;
    return {
      start: leadingText.length + leadingWs,
      end: leadingText.length + captured.length - trailingWs,
    };
  }

  replace(replacement: string) {
    return (
      InputMatch.joinInput(this.leading) +
      replacement +
      InputMatch.joinInput(this.remaining)
    );
  }

  replaceTrimmed(replacement: string) {
    const original = this.capturedText;
    const leadingWsMatch = original.match(/^\s*/);
    const trailingWsMatch = original.match(/\s*$/);
    const leadingWhitespace = leadingWsMatch ? leadingWsMatch[0] : "";
    const trailingWhitespace = trailingWsMatch ? trailingWsMatch[0] : "";
    return (
      InputMatch.joinInput(this.leading) +
      leadingWhitespace +
      replacement +
      trailingWhitespace +
      InputMatch.joinInput(this.remaining)
    );
  }
}

export class KeywordPattern {
  constructor(public matcher: Matcher) {
    this.matcher = matcher;
  }

  match(input: string): InputMatch | undefined {
    if (!input.trim()) return undefined;
    const words = tokenizeInput(input);
    for (let i = 0; i < words.length; i++) {
      const rest = words.slice(i);
      const matchResults = this.matcher.match(rest);
      const result = matchResults[0];
      if (result) {
        return new InputMatch({
          leading: words.slice(0, i),
          captured: result.captured,
          remaining: result.remaining,
          tags: result.tags,
        });
      }
    }
    return undefined;
  }

  /**
   * Find every non-overlapping match in `input`, in left-to-right order.
   * After each successful match, scanning resumes immediately past the
   * matched words — so "send a message and send a message" yields two
   * matches, not three (or one).
   */
  matchAll(input: string): InputMatch[] {
    if (!input.trim()) return [];
    const words = tokenizeInput(input);
    const results: InputMatch[] = [];
    let i = 0;
    while (i < words.length) {
      const rest = words.slice(i);
      const matchResults = this.matcher.match(rest);
      const result = matchResults[0];
      if (result) {
        results.push(
          new InputMatch({
            leading: words.slice(0, i),
            captured: result.captured,
            remaining: result.remaining,
            tags: result.tags,
          }),
        );
        // Advance past the matched words. A zero-length match would loop
        // forever, so step at least one word in that case.
        i += result.captured.length > 0 ? result.captured.length : 1;
      } else {
        i++;
      }
    }
    return results;
  }

  static compile(pattern: string): KeywordPattern {
    return new KeywordPattern(compilePattern(pattern));
  }
}
