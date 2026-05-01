/**
 * Pure reducer over the transcript and the `question`/`send` matches
 * found within it. Walks the matches in left-to-right order and emits:
 *
 *  - `qaCalls`: completed `question … send` brackets, each with a
 *    stable `id` (the span's char range) so the caller can cache LLM
 *    results without re-firing on every render.
 *  - `pendingQuestion`: text after a `question` marker that hasn't yet
 *    been closed by a `send`. Useful for showing a live "asking…" chip
 *    while the user is still talking.
 *
 * Empty brackets (`question` immediately followed by `send`) are
 * silently dropped — there's nothing to ask the LLM.
 *
 * The function is intentionally testable in isolation: callers compute
 * the keyword matches with their preferred matcher and pass char ranges
 * in here.
 */

export interface KeywordHit {
  start: number;
  end: number;
}

export interface QaCall {
  id: string;
  /** Char index where the question text starts (after the `question` marker). */
  startIndex: number;
  /** Char index where the question text ends (before the `send` marker). */
  endIndex: number;
  transcribed: string;
}

export interface PendingQuestion {
  startIndex: number;
  transcribed: string;
}

export interface DerivedState {
  qaCalls: QaCall[];
  pendingQuestion: PendingQuestion | null;
}

interface DeriveArgs {
  transcript: string;
  questionHits: readonly KeywordHit[];
  sendHits: readonly KeywordHit[];
}

interface Event {
  kind: "question" | "send";
  start: number;
  end: number;
}

function interleave(args: DeriveArgs): Event[] {
  const events: Event[] = [];
  for (const m of args.questionHits) {
    events.push({ kind: "question", start: m.start, end: m.end });
  }
  for (const m of args.sendHits) {
    events.push({ kind: "send", start: m.start, end: m.end });
  }
  events.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    // On a tie, the longer span comes first so it claims the position.
    return b.end - a.end;
  });
  return events;
}

export function deriveState(args: DeriveArgs): DerivedState {
  const { transcript } = args;
  const events = interleave(args);

  const qaCalls: QaCall[] = [];
  let openQuestionEndIdx: number | null = null;

  for (const e of events) {
    if (e.kind === "question") {
      if (openQuestionEndIdx === null) {
        openQuestionEndIdx = e.end;
      }
      // Already collecting; ignore consecutive `question` markers so a
      // re-trigger doesn't accidentally drop the user's first question.
      continue;
    }
    if (openQuestionEndIdx !== null) {
      const startIndex = openQuestionEndIdx;
      const endIndex = e.start;
      const transcribed = transcript.slice(startIndex, endIndex).trim();
      if (transcribed.length > 0) {
        qaCalls.push({
          id: `${startIndex}-${endIndex}`,
          startIndex,
          endIndex,
          transcribed,
        });
      }
      openQuestionEndIdx = null;
    }
    // `send` while idle is a no-op.
  }

  let pendingQuestion: PendingQuestion | null = null;
  if (openQuestionEndIdx !== null) {
    const tail = transcript.slice(openQuestionEndIdx).trim();
    pendingQuestion = {
      startIndex: openQuestionEndIdx,
      transcribed: tail,
    };
  }

  return { qaCalls, pendingQuestion };
}
