/* eslint-disable error/no-literal-error-message, security/detect-possible-timing-attacks */
/**
 * Compile and tokenize side of patmatch.
 *
 * `tokenizePattern` chops the pattern source into tokens; the `compile*`
 * functions consume those tokens and produce a tree of matcher classes
 * from `./patmatch-internals.js`. `tokenizeInput` is the runtime tokenizer
 * — it preserves each word's original surface so InputMatch can reproduce
 * the input verbatim or report char ranges for highlighting.
 *
 * Lint disables: error/no-literal-error-message because pattern compile
 * errors carry their offending source in the message and aren't caught
 * for recovery; security/detect-possible-timing-attacks because the
 * `===` checks here are token equality during parsing, not security
 * comparisons.
 */

import {
  KeywordPatternError,
  type Matcher,
  type InputWord,
  WordMatcher,
  OptionalMatcher,
  SequenceMatcher,
  OrMatcher,
  normalizeWord,
} from "./patmatch-internals.js";

export type PatternToken = string | Record<string, string>;

export function tokenizePattern(src: string): PatternToken[] {
  const tagRe = /^\[([^\]=]+)=([^\]]+)\]/gu;
  const re = /^\n|\(|\)|\||\?|\s+|[^()|?[\]=\s]+/gu;
  const list: PatternToken[] = [];
  let remaining = src;
  while (remaining) {
    const tagMatch = tagRe.exec(remaining);
    if (tagMatch && tagMatch[1] !== undefined && tagMatch[2] !== undefined) {
      const name = tagMatch[1];
      const value = tagMatch[2];
      list.push({ [name]: value });
      remaining = remaining.slice(tagMatch[0].length);
      continue;
    }
    if (remaining.startsWith("[")) {
      throw new KeywordPatternError(
        `Invalid pattern (bad tag): ${JSON.stringify(src)} at ${JSON.stringify(remaining)}`,
      );
    }
    const match = remaining.match(re);
    if (match) {
      if (match[0].trim() || match[0] === "\n") {
        list.push(match[0]);
      }
      remaining = remaining.slice(match[0].length);
      continue;
    }
    throw new KeywordPatternError(
      `Invalid pattern (bad word): ${JSON.stringify(src)} at ${JSON.stringify(remaining)}`,
    );
  }
  return list;
}

export function tokenizeInput(text: string): InputWord[] {
  const result: InputWord[] = [];
  const startMatch = text.match(/^[\s\p{P}]*/u);
  let firstLeading = startMatch ? startMatch[0] : "";
  let remaining = text;
  if (!text.slice(firstLeading.length)) {
    return result;
  }

  while (remaining) {
    let leading: string;
    if (firstLeading) {
      leading = firstLeading;
    } else {
      const m = remaining.match(/^\p{P}*/u);
      leading = m ? m[0] : "";
    }
    remaining = remaining.slice(leading.length);
    // Allows a single internal apostrophe (don't, it's). Other internal
    // punctuation isn't supported — sufficient for the kinds of phrases
    // we match against.
    const originalMatch = remaining.match(/^[^\p{P}\s]*(?:['][^\p{P}\s]+)?/u);
    const original = originalMatch ? originalMatch[0] : "";
    remaining = remaining.slice(original.length);
    const trailingMatch = remaining.match(/^\p{P}*\s*/u);
    const trailing = trailingMatch ? trailingMatch[0] : "";
    remaining = remaining.slice(trailing.length);
    firstLeading = "";
    const normalized = normalizeWord(original);
    const first = result[0];
    const last = result[result.length - 1];
    if (normalized && result.length === 1 && first && first.normalized === "") {
      first.leading += leading;
      first.original += original;
      first.trailing += trailing;
      first.normalized = normalized;
    } else if (!normalized && last) {
      last.trailing += leading + original + trailing;
      continue;
    } else if (!normalized && result.length === 0) {
      result.push({
        normalized: "",
        original,
        trailing: "",
        leading: leading + trailing,
      });
    } else {
      result.push({ normalized, original, trailing, leading });
    }
  }
  return result;
}

class TokenStream {
  constructor(private tokens: PatternToken[]) {
    this.tokens = tokens;
  }
  next() {
    return this.tokens.shift();
  }
  peek() {
    return this.tokens[0];
  }
  isEmpty() {
    return this.tokens.length === 0;
  }
}

function compileLines(stream: TokenStream): Matcher {
  const matchers: Matcher[] = [];
  let tags: Record<string, string> = {};
  let currentSequence: Matcher[] = [];
  while (true) {
    if (stream.isEmpty() || stream.peek() === "\n") {
      if (currentSequence.length === 0) {
        if (Object.keys(tags).length > 0) {
          throw new KeywordPatternError("Pattern has tags with no words");
        }
        if (stream.isEmpty()) break;
        stream.next();
        continue;
      }
      matchers.push(new SequenceMatcher(tags, currentSequence));
      currentSequence = [];
      tags = {};
      if (stream.isEmpty()) break;
      stream.next();
      continue;
    }
    const token = stream.peek();
    if (typeof token !== "string") {
      Object.assign(tags, token);
      stream.next();
      continue;
    }
    currentSequence.push(compileForWord(stream));
  }
  return new OrMatcher({ tags: {}, matchers, separator: "\n" });
}

function compileForWord(stream: TokenStream): Matcher {
  const token = stream.next();
  if (typeof token !== "string") {
    throw new KeywordPatternError("Unexpected tags");
  }
  if (token === "(") return compileGroup(stream);
  if (token === "|") {
    // Treat a leading "|" as an empty alternative — wrap the next word as
    // optional. Used for "(a | b | )"-style optional groups.
    const match = compileForWord(stream);
    return new OptionalMatcher({}, match);
  }
  if (token === "?" || token === ")") {
    throw new KeywordPatternError(`Unexpected "${token}"`);
  }
  const word = normalizeWord(token);
  if (stream.peek() === "?") {
    stream.next();
    return new OptionalMatcher({}, new WordMatcher({}, word));
  }
  return new WordMatcher({}, word);
}

function compileGroup(stream: TokenStream): Matcher {
  const matchers: Matcher[] = [];
  let currentSequence: Matcher[] = [];
  let isOptional = false;
  while (true) {
    if (stream.isEmpty()) {
      throw new KeywordPatternError("Expected closing )");
    }
    const token = stream.peek();
    if (token === ")") {
      stream.next();
      if (currentSequence.length === 1 && currentSequence[0]) {
        matchers.push(currentSequence[0]);
      } else if (currentSequence.length > 1) {
        matchers.push(new SequenceMatcher({}, currentSequence));
      } else {
        isOptional = true;
      }
      if (stream.peek() === "?") {
        stream.next();
        isOptional = true;
      }
      break;
    } else if (token === "|") {
      stream.next();
      if (currentSequence.length === 1 && currentSequence[0]) {
        matchers.push(currentSequence[0]);
        currentSequence = [];
      } else if (currentSequence.length > 1) {
        matchers.push(new SequenceMatcher({}, currentSequence));
        currentSequence = [];
      } else {
        isOptional = true;
      }
    } else {
      currentSequence.push(compileForWord(stream));
    }
  }
  const orMatch = new OrMatcher({ tags: {}, matchers, separator: "|" });
  if (isOptional) return new OptionalMatcher({}, orMatch);
  return orMatch;
}

export function compilePattern(src: string): Matcher {
  const tokens = tokenizePattern(src);
  return compileLines(new TokenStream(tokens));
}
