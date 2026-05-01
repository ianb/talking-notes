/**
 * Pure reducers over the language-learning matches. Two related but
 * separate concerns live here:
 *
 *   - `deriveQaState`: walks the question/send markers in order to emit
 *     completed Q&A brackets (and, if a question is still open, a
 *     `pendingQuestion` describing the live span).
 *   - `deriveCritiqueCalls`: walks the critique markers and, for each
 *     one, slices out the Spanish content for the section ending at
 *     that critique. The Spanish content excludes any question…send
 *     brackets in that section — the model only needs to see the
 *     student's target-language speech.
 *
 * Both functions accept char-range hits keyed by the active mode's
 * `modeStartIndex` so callers can ignore matches from other mode
 * sessions on the same transcript.
 */

export interface KeywordHit {
  start: number;
  end: number;
}

export interface QaCall {
  id: string;
  startIndex: number;
  endIndex: number;
  transcribed: string;
}

export interface PendingQuestion {
  startIndex: number;
  transcribed: string;
}

export interface QaState {
  qaCalls: QaCall[];
  pendingQuestion: PendingQuestion | null;
}

interface DeriveQaArgs {
  transcript: string;
  questionHits: readonly KeywordHit[];
  sendHits: readonly KeywordHit[];
}

interface OrderedEvent {
  kind: "question" | "send";
  start: number;
  end: number;
}

function orderQaEvents(args: DeriveQaArgs): OrderedEvent[] {
  const events: OrderedEvent[] = [];
  for (const m of args.questionHits) {
    events.push({ kind: "question", start: m.start, end: m.end });
  }
  for (const m of args.sendHits) {
    events.push({ kind: "send", start: m.start, end: m.end });
  }
  return events.toSorted((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - a.end;
  });
}

export function deriveQaState(args: DeriveQaArgs): QaState {
  const { transcript } = args;
  const events = orderQaEvents(args);

  const qaCalls: QaCall[] = [];
  let openQuestionEndIdx: number | null = null;

  for (const e of events) {
    if (e.kind === "question") {
      if (openQuestionEndIdx === null) openQuestionEndIdx = e.end;
      continue;
    }
    if (openQuestionEndIdx !== null) {
      const startIndex = openQuestionEndIdx;
      const endIndex = e.start;
      const transcribed = transcript.slice(startIndex, endIndex).trim();
      if (transcribed.length > 0) {
        qaCalls.push({
          id: `qa-${startIndex}-${endIndex}`,
          startIndex,
          endIndex,
          transcribed,
        });
      }
      openQuestionEndIdx = null;
    }
  }

  let pendingQuestion: PendingQuestion | null = null;
  if (openQuestionEndIdx !== null) {
    pendingQuestion = {
      startIndex: openQuestionEndIdx,
      transcribed: transcript.slice(openQuestionEndIdx).trim(),
    };
  }

  return { qaCalls, pendingQuestion };
}

export interface CritiqueCall {
  id: string;
  /** Char index of the critique marker — used for chronological sorting. */
  position: number;
  /** Spanish content for the section, with question…send spans removed. */
  spanishContent: string;
}

interface DeriveCritiqueArgs {
  transcript: string;
  questionHits: readonly KeywordHit[];
  sendHits: readonly KeywordHit[];
  critiqueHits: readonly KeywordHit[];
  /** Walk only from this index onward — earlier text belongs to a previous mode session. */
  modeStartIndex: number;
}

/**
 * Slice the Spanish-only content out of `transcript[sectionStart..sectionEnd]`.
 * Walks the question/send hits inside the range and skips any text that
 * falls inside an open question bracket. Marker text itself is also
 * elided.
 */
function extractSpanishSection({
  transcript,
  sectionStart,
  sectionEnd,
  questionHits,
  sendHits,
}: {
  transcript: string;
  sectionStart: number;
  sectionEnd: number;
  questionHits: readonly KeywordHit[];
  sendHits: readonly KeywordHit[];
}): string {
  const events: { kind: "question" | "send"; start: number; end: number }[] =
    [];
  for (const h of questionHits) {
    if (h.start >= sectionStart && h.end <= sectionEnd) {
      events.push({ kind: "question", start: h.start, end: h.end });
    }
  }
  for (const h of sendHits) {
    if (h.start >= sectionStart && h.end <= sectionEnd) {
      events.push({ kind: "send", start: h.start, end: h.end });
    }
  }
  const sorted = events.toSorted((a, b) => a.start - b.start);

  const parts: string[] = [];
  let cursor = sectionStart;
  let inQuestion = false;
  for (const e of sorted) {
    if (!inQuestion && e.start > cursor) {
      parts.push(transcript.slice(cursor, e.start));
    }
    if (e.kind === "question") inQuestion = true;
    else inQuestion = false;
    cursor = e.end;
  }
  if (!inQuestion && cursor < sectionEnd) {
    parts.push(transcript.slice(cursor, sectionEnd));
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function deriveCritiqueCalls({
  transcript,
  questionHits,
  sendHits,
  critiqueHits,
  modeStartIndex,
}: DeriveCritiqueArgs): CritiqueCall[] {
  const calls: CritiqueCall[] = [];
  let sectionStart = modeStartIndex;
  for (const hit of critiqueHits) {
    if (hit.start < modeStartIndex) continue;
    const spanishContent = extractSpanishSection({
      transcript,
      sectionStart,
      sectionEnd: hit.start,
      questionHits,
      sendHits,
    });
    if (spanishContent.length > 0) {
      calls.push({
        id: `cr-${hit.start}-${hit.end}`,
        position: hit.start,
        spanishContent,
      });
    }
    sectionStart = hit.end;
  }
  return calls;
}
