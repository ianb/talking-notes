import t from "tap";
import type { ParsedDocument } from "../../../src/demos/reading/types.js";

const { readingReducer } = await import(
  "../../../src/demos/reading/state.js"
);
type ReadingState =
  import("../../../src/demos/reading/state.js").ReadingState;

function makeState(overrides: Partial<ReadingState> = {}): ReadingState {
  return {
    phase: "setup",
    document: null,
    events: [],
    readingStartTime: null,
    synthesisResult: null,
    processingStatus: null,
    error: null,
    ...overrides,
  };
}

const fakeDoc: ParsedDocument = {
  title: "Test",
  rawMarkdown: "# Test",
  segments: [{ id: "seg-0", index: 0, markdown: "# Test", plainText: "Test" }],
};

t.test("SET_DOCUMENT stores document", (t) => {
  const state = readingReducer(makeState(), {
    type: "SET_DOCUMENT",
    doc: fakeDoc,
  });
  t.equal(state.document?.title, "Test");
  t.end();
});

t.test("START_READING transitions to reading phase", (t) => {
  const state = readingReducer(makeState(), { type: "START_READING" });
  t.equal(state.phase, "reading");
  t.ok(state.readingStartTime);
  t.same(state.events, []);
  t.end();
});

t.test("APPEND_TRANSCRIPT_DELTA creates pending transcript", (t) => {
  const state = readingReducer(makeState({ phase: "reading" }), {
    type: "APPEND_TRANSCRIPT_DELTA",
    delta: "hello ",
    time: 100,
  });
  t.equal(state.events.length, 1);
  const ev = state.events[0];
  t.equal(ev.kind, "transcript");
  if (ev.kind === "transcript") {
    t.equal(ev.text, "hello ");
    t.equal(ev.pending, true);
  }
  t.end();
});

t.test("APPEND_TRANSCRIPT_DELTA extends pending transcript", (t) => {
  let state = readingReducer(makeState({ phase: "reading" }), {
    type: "APPEND_TRANSCRIPT_DELTA",
    delta: "hello ",
    time: 100,
  });
  state = readingReducer(state, {
    type: "APPEND_TRANSCRIPT_DELTA",
    delta: "world",
    time: 200,
  });
  t.equal(state.events.length, 1);
  const ev = state.events[0];
  if (ev.kind === "transcript") {
    t.equal(ev.text, "hello world");
    t.equal(ev.endTime, 200);
  }
  t.end();
});

t.test("ADD_SCROLL appends after transcript, finalizing it", (t) => {
  let state = readingReducer(makeState({ phase: "reading" }), {
    type: "APPEND_TRANSCRIPT_DELTA",
    delta: "some speech",
    time: 100,
  });
  state = readingReducer(state, {
    type: "ADD_SCROLL",
    time: 200,
    visibleSegmentIds: ["seg-0"],
  });
  t.equal(state.events.length, 2);
  const transcript = state.events[0];
  if (transcript.kind === "transcript") {
    t.equal(transcript.pending, false);
  }
  t.equal(state.events[1].kind, "scroll");
  t.end();
});

t.test("ADD_SCROLL replaces previous scroll when no text between", (t) => {
  let state = readingReducer(makeState({ phase: "reading" }), {
    type: "ADD_SCROLL",
    time: 100,
    visibleSegmentIds: ["seg-0"],
  });
  state = readingReducer(state, {
    type: "ADD_SCROLL",
    time: 200,
    visibleSegmentIds: ["seg-1"],
  });
  t.equal(state.events.length, 1);
  const ev = state.events[0];
  if (ev.kind === "scroll") {
    t.same(ev.visibleSegmentIds, ["seg-1"]);
    t.equal(ev.time, 200);
  }
  t.end();
});

t.test("ADD_SCROLL keeps previous scroll when text arrived between", (t) => {
  let state = readingReducer(makeState({ phase: "reading" }), {
    type: "ADD_SCROLL",
    time: 100,
    visibleSegmentIds: ["seg-0"],
  });
  state = readingReducer(state, {
    type: "APPEND_TRANSCRIPT_DELTA",
    delta: "talking",
    time: 150,
  });
  state = readingReducer(state, {
    type: "ADD_SCROLL",
    time: 200,
    visibleSegmentIds: ["seg-1"],
  });
  t.equal(state.events.length, 3);
  t.equal(state.events[0].kind, "scroll");
  t.equal(state.events[1].kind, "transcript");
  t.equal(state.events[2].kind, "scroll");
  t.end();
});

t.test("ADD_SELECTION appends and finalizes pending transcript", (t) => {
  let state = readingReducer(makeState({ phase: "reading" }), {
    type: "APPEND_TRANSCRIPT_DELTA",
    delta: "speaking",
    time: 100,
  });
  state = readingReducer(state, {
    type: "ADD_SELECTION",
    time: 200,
    segmentId: "seg-0",
    text: "quoted bit",
  });
  t.equal(state.events.length, 2);
  const transcript = state.events[0];
  if (transcript.kind === "transcript") {
    t.equal(transcript.pending, false);
  }
  const sel = state.events[1];
  if (sel.kind === "selection") {
    t.equal(sel.text, "quoted bit");
    t.equal(sel.segmentId, "seg-0");
  }
  t.end();
});

t.test("FINALIZE_TRANSCRIPT flips pending flag", (t) => {
  let state = readingReducer(makeState({ phase: "reading" }), {
    type: "APPEND_TRANSCRIPT_DELTA",
    delta: "hi",
    time: 100,
  });
  state = readingReducer(state, { type: "FINALIZE_TRANSCRIPT" });
  const ev = state.events[0];
  if (ev.kind === "transcript") {
    t.equal(ev.pending, false);
  }
  t.end();
});

t.test("START_PROCESSING transitions to processing", (t) => {
  const state = readingReducer(makeState({ phase: "reading" }), {
    type: "START_PROCESSING",
  });
  t.equal(state.phase, "processing");
  t.ok(state.processingStatus);
  t.end();
});

t.test("RESET returns to initial state", (t) => {
  const state = readingReducer(
    makeState({
      phase: "results",
      document: fakeDoc,
    }),
    { type: "RESET" },
  );
  t.equal(state.phase, "setup");
  t.equal(state.document, null);
  t.same(state.events, []);
  t.end();
});
