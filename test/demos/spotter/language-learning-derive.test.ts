import t from "tap";
import {
  deriveCritiqueCalls,
  deriveQaState,
  type KeywordHit,
} from "../../../src/demos/spotter/modes/language-learning/deriveState.js";

interface QaBuild {
  transcript: string;
  question: { start: number; end: number }[];
  send: { start: number; end: number }[];
}

function buildQa(args: QaBuild) {
  return deriveQaState({
    transcript: args.transcript,
    questionHits: args.question as readonly KeywordHit[],
    sendHits: args.send as readonly KeywordHit[],
  });
}

t.test("deriveQaState: question … send emits one qaCall", (t) => {
  const transcript = "hola question how do you say dog send adios";
  const result = buildQa({
    transcript,
    question: [{ start: 5, end: 13 }],
    send: [{ start: 33, end: 37 }],
  });
  t.equal(result.qaCalls.length, 1);
  const first = result.qaCalls[0];
  if (!first) {
    t.fail("expected one call");
    return t.end();
  }
  t.equal(first.transcribed, "how do you say dog");
  t.equal(first.id, "qa-13-33");
  t.equal(result.pendingQuestion, null);
  t.end();
});

t.test("deriveQaState: open question without send → pendingQuestion", (t) => {
  const transcript = "hola question how do you say dog";
  const result = buildQa({
    transcript,
    question: [{ start: 5, end: 13 }],
    send: [],
  });
  t.equal(result.qaCalls.length, 0);
  t.ok(result.pendingQuestion !== null);
  if (result.pendingQuestion !== null) {
    t.equal(result.pendingQuestion.transcribed, "how do you say dog");
  }
  t.end();
});

t.test("deriveQaState: empty bracket is dropped", (t) => {
  const transcript = "ok question send que tal";
  const result = buildQa({
    transcript,
    question: [{ start: 3, end: 11 }],
    send: [{ start: 12, end: 16 }],
  });
  t.equal(result.qaCalls.length, 0);
  t.equal(result.pendingQuestion, null);
  t.end();
});

interface CritiqueBuild {
  transcript: string;
  question: { start: number; end: number }[];
  send: { start: number; end: number }[];
  critique: { start: number; end: number }[];
  modeStartIndex?: number;
}

function buildCritique(args: CritiqueBuild) {
  return deriveCritiqueCalls({
    transcript: args.transcript,
    questionHits: args.question as readonly KeywordHit[],
    sendHits: args.send as readonly KeywordHit[],
    critiqueHits: args.critique as readonly KeywordHit[],
    modeStartIndex: args.modeStartIndex === undefined ? 0 : args.modeStartIndex,
  });
}

t.test("deriveCritiqueCalls: simple Spanish run before critique marker", (t) => {
  // "tengo muchos perros critique this"
  //  0          14            20      32
  const transcript = "tengo muchos perros critique this";
  const result = buildCritique({
    transcript,
    question: [],
    send: [],
    critique: [{ start: 20, end: 33 }],
  });
  t.equal(result.length, 1);
  const first = result[0];
  if (!first) {
    t.fail("expected one call");
    return t.end();
  }
  t.equal(first.spanishContent, "tengo muchos perros");
  t.equal(first.position, 20);
  t.end();
});

t.test("deriveCritiqueCalls: question…send brackets are excluded from spanish content", (t) => {
  // "hola question how do you say dog send adios critique this"
  //  0    5        14                 33   38    44
  const transcript = "hola question how do you say dog send adios critique this";
  const result = buildCritique({
    transcript,
    question: [{ start: 5, end: 13 }],
    send: [{ start: 33, end: 37 }],
    critique: [{ start: 44, end: 57 }],
  });
  t.equal(result.length, 1);
  const first = result[0];
  if (!first) {
    t.fail("expected one call");
    return t.end();
  }
  // Only the Spanish: "hola" + "adios" — the question..send range is dropped.
  t.equal(first.spanishContent, "hola adios");
  t.end();
});

t.test("deriveCritiqueCalls: empty section is dropped", (t) => {
  const transcript = "critique this";
  const result = buildCritique({
    transcript,
    question: [],
    send: [],
    critique: [{ start: 0, end: 13 }],
  });
  t.equal(result.length, 0);
  t.end();
});

t.test("deriveCritiqueCalls: multiple critiques emit separate calls", (t) => {
  // "una critique this dos critique this"
  //  0   4             18  22           34
  const transcript = "una critique this dos critique this";
  const result = buildCritique({
    transcript,
    question: [],
    send: [],
    critique: [
      { start: 4, end: 17 },
      { start: 22, end: 35 },
    ],
  });
  t.equal(result.length, 2);
  const a = result[0];
  const b = result[1];
  if (!a || !b) {
    t.fail("expected two calls");
    return t.end();
  }
  t.equal(a.spanishContent, "una");
  t.equal(b.spanishContent, "dos");
  t.ok(a.position < b.position, "calls in transcript order");
  t.end();
});

t.test("deriveCritiqueCalls: modeStartIndex anchors section start", (t) => {
  // Pretend a previous mode session left text at the start of the
  // transcript that this mode session shouldn't see.
  const transcript = "previous mode chatter then hola critique this";
  // "hola" starts at index 27 and "critique this" at 32.
  const result = buildCritique({
    transcript,
    question: [],
    send: [],
    critique: [{ start: 32, end: 45 }],
    modeStartIndex: 27,
  });
  t.equal(result.length, 1);
  const first = result[0];
  if (!first) {
    t.fail("expected one call");
    return t.end();
  }
  t.equal(first.spanishContent, "hola");
  t.end();
});
