import t from "tap";
import {
  deriveState,
  type KeywordHit,
} from "../../../src/demos/language-learning/deriveState.js";

interface BuildArgs {
  transcript: string;
  question: { start: number; end: number }[];
  send: { start: number; end: number }[];
}

function build(args: BuildArgs) {
  return deriveState({
    transcript: args.transcript,
    questionHits: args.question as readonly KeywordHit[],
    sendHits: args.send as readonly KeywordHit[],
  });
}

t.test("no markers → no qaCalls and no pending", (t) => {
  const result = build({
    transcript: "sí, tengo muchos perros en casa",
    question: [],
    send: [],
  });
  t.equal(result.qaCalls.length, 0);
  t.equal(result.pendingQuestion, null);
  t.end();
});

t.test("question … send emits one qaCall with the inner text", (t) => {
  // "hola question how do you say dog send adios"
  //  0     5        14                 32   37
  const transcript = "hola question how do you say dog send adios";
  const result = build({
    transcript,
    question: [{ start: 5, end: 13 }], // "question"
    send: [{ start: 33, end: 37 }], // "send"
  });
  t.equal(result.qaCalls.length, 1);
  const first = result.qaCalls[0];
  if (!first) {
    t.fail("expected one call");
    return t.end();
  }
  t.equal(first.transcribed, "how do you say dog");
  t.equal(first.id, "13-33");
  t.equal(result.pendingQuestion, null);
  t.end();
});

t.test("question with no following send leaves pendingQuestion", (t) => {
  const transcript = "hola question how do you say dog";
  const result = build({
    transcript,
    question: [{ start: 5, end: 13 }],
    send: [],
  });
  t.equal(result.qaCalls.length, 0);
  t.ok(result.pendingQuestion !== null);
  if (result.pendingQuestion !== null) {
    t.equal(result.pendingQuestion.transcribed, "how do you say dog");
    t.equal(result.pendingQuestion.startIndex, 13);
  }
  t.end();
});

t.test("empty bracket (question immediately followed by send) is dropped", (t) => {
  const transcript = "ok question send que tal";
  const result = build({
    transcript,
    question: [{ start: 3, end: 11 }],
    send: [{ start: 12, end: 16 }],
  });
  t.equal(result.qaCalls.length, 0);
  t.equal(result.pendingQuestion, null);
  t.end();
});

t.test("send while idle is a no-op", (t) => {
  const transcript = "hola send adios";
  const result = build({
    transcript,
    question: [],
    send: [{ start: 5, end: 9 }],
  });
  t.equal(result.qaCalls.length, 0);
  t.equal(result.pendingQuestion, null);
  t.end();
});

t.test("consecutive question markers don't reset the open span", (t) => {
  // "question first question still asking send"
  //  0        9     15       21    27     34 38
  const transcript = "question first question still asking send";
  const result = build({
    transcript,
    question: [
      { start: 0, end: 8 },
      { start: 15, end: 23 },
    ],
    send: [{ start: 37, end: 41 }],
  });
  t.equal(result.qaCalls.length, 1);
  const first = result.qaCalls[0];
  if (!first) {
    t.fail("expected one call");
    return t.end();
  }
  // Bracket starts at the *first* question marker so we don't drop the
  // user's earlier words on a re-trigger.
  t.equal(first.startIndex, 8);
  t.equal(first.endIndex, 37);
  t.equal(first.transcribed, "first question still asking");
  t.end();
});

t.test("multiple completed brackets accumulate in order", (t) => {
  const transcript = "question one send middle question two send tail";
  const result = build({
    transcript,
    question: [
      { start: 0, end: 8 },
      { start: 25, end: 33 },
    ],
    send: [
      { start: 13, end: 17 },
      { start: 38, end: 42 },
    ],
  });
  t.equal(result.qaCalls.length, 2);
  const a = result.qaCalls[0];
  const b = result.qaCalls[1];
  if (!a || !b) {
    t.fail("expected two calls");
    return t.end();
  }
  t.equal(a.transcribed, "one");
  t.equal(b.transcribed, "two");
  t.ok(a.startIndex < b.startIndex, "calls in transcript order");
  t.end();
});
