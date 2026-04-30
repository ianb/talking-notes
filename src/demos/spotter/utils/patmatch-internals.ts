/* eslint-disable error/no-literal-error-message */
/**
 * Internals of the patmatch library: matcher classes, the error class
 * used by the compiler, and the word-normalization function shared by
 * compilation and runtime matching.
 *
 * The error rule disable applies because pattern compile failures are
 * programmer errors during pattern authoring — they're not caught and
 * recovered from at runtime, and embedding the offending source in the
 * message is the whole point.
 */

export class KeywordPatternError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeywordPatternError";
  }
}

export interface InputWord {
  normalized: string;
  original: string;
  trailing: string;
  leading: string;
}

export interface MatchResult {
  captured: InputWord[];
  remaining: InputWord[];
  tags: Record<string, string>;
}

export function normalizeWord(word: string): string {
  return word
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036F]/g, "")
    .replace(/[^\da-z]/g, "");
}

export abstract class Matcher {
  constructor(public tags: Record<string, string>) {
    this.tags = tags;
  }
  abstract match(input: InputWord[]): MatchResult[];
  abstract repr(): string;
}

export class WordMatcher extends Matcher {
  private word: string;
  constructor(tags: Record<string, string>, word: string) {
    super(tags);
    this.word = normalizeWord(word);
  }
  match(input: InputWord[]) {
    const head = input[0];
    if (head && head.normalized === this.word) {
      return [
        {
          captured: input.slice(0, 1),
          remaining: input.slice(1),
          tags: this.tags,
        },
      ];
    }
    return [];
  }
  repr() {
    return this.word;
  }
}

export class OptionalMatcher extends Matcher {
  constructor(
    tags: Record<string, string>,
    private matcher: Matcher,
  ) {
    super(tags);
  }
  match(input: InputWord[]) {
    const result = this.matcher.match(input);
    return [
      ...result.map((r) => ({
        ...r,
        tags: Object.assign({}, this.tags, r.tags),
      })),
      { captured: [], remaining: input, tags: this.tags },
    ];
  }
  repr() {
    return `${this.matcher.repr()}?`;
  }
}

export class SequenceMatcher extends Matcher {
  constructor(
    tags: Record<string, string>,
    private matchers: Matcher[],
  ) {
    super(tags);
  }
  match(input: InputWord[]) {
    let result: MatchResult[] = [
      { captured: [], remaining: input, tags: this.tags },
    ];
    for (const matcher of this.matchers) {
      result = result.flatMap((r) => {
        const next = matcher.match(r.remaining);
        return next.map((n) => ({
          captured: [...r.captured, ...n.captured],
          remaining: n.remaining,
          tags: Object.assign({}, this.tags, n.tags),
        }));
      });
    }
    return result;
  }
  repr() {
    return this.matchers.map((m) => m.repr()).join(" ");
  }
}

interface OrMatcherOptions {
  tags: Record<string, string>;
  matchers: Matcher[];
  separator: string;
}

export class OrMatcher extends Matcher {
  private matchers: Matcher[];
  private separator: string;
  constructor(options: OrMatcherOptions) {
    super(options.tags);
    this.separator = options.separator;
    this.matchers = options.matchers;
  }
  match(input: InputWord[]) {
    return this.matchers.flatMap((m) => {
      const result = m.match(input);
      return result.map((r) => ({
        ...r,
        tags: Object.assign({}, this.tags, r.tags),
      }));
    });
  }
  repr() {
    if (this.separator === "|") {
      return `(${this.matchers.map((m) => m.repr()).join(" | ")})`;
    }
    if (this.separator === "\n") {
      return this.matchers.map((m) => m.repr()).join("\n");
    }
    throw new KeywordPatternError(`Unknown separator: ${this.separator}`);
  }
}
