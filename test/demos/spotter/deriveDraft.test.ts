import t from "tap";
import { findMatches } from "../../../src/demos/spotter/modes/findMatches.js";
import { deriveDraftState } from "../../../src/demos/spotter/modes/edit/deriveDraft.js";
import { EDIT_KEYWORDS } from "../../../src/demos/spotter/modes/edit/keywords.js";
import { type ModeMatch } from "../../../src/demos/spotter/modes/types.js";

function matchesFor(transcript: string): ModeMatch[] {
  return findMatches(transcript, {
    modeKeywords: EDIT_KEYWORDS,
    modeId: "edit",
    switchKeywords: [],
  });
}

t.test("plain dictation flows into the draft", (t) => {
  const transcript = "hello team how are you";
  const result = deriveDraftState({
    transcript,
    matches: matchesFor(transcript),
    appliedEdits: new Map(),
    modeStartIndex: 0,
  });
  t.equal(result.draft, transcript);
  t.equal(result.editing, null);
  t.equal(result.frozen, false);
  t.equal(result.pendingEdit, null);
  t.end();
});

t.test("send message clears the draft and increments the counter", (t) => {
  const transcript = "hello there send message";
  const result = deriveDraftState({
    transcript,
    matches: matchesFor(transcript),
    appliedEdits: new Map(),
    modeStartIndex: 0,
  });
  t.equal(result.draft, "");
  t.equal(result.counters.sent, 1);
  t.end();
});

t.test("clear message wipes the draft", (t) => {
  const transcript = "hello there clear message";
  const result = deriveDraftState({
    transcript,
    matches: matchesFor(transcript),
    appliedEdits: new Map(),
    modeStartIndex: 0,
  });
  t.equal(result.draft, "");
  t.equal(result.counters.cleared, 1);
  t.end();
});

t.test("modeStartIndex anchors so pre-mode text is ignored", (t) => {
  const transcript = "earlier notes-mode chatter then dictation here";
  const startIndex = transcript.indexOf("then");
  const result = deriveDraftState({
    transcript,
    matches: matchesFor(transcript),
    appliedEdits: new Map(),
    modeStartIndex: startIndex,
  });
  t.equal(result.draft, transcript.slice(startIndex));
  t.end();
});

t.test("start edit … end edit freezes when LLM result is missing", (t) => {
  const transcript = "Hello team. start edit make it formal end edit";
  const result = deriveDraftState({
    transcript,
    matches: matchesFor(transcript),
    appliedEdits: new Map(),
    modeStartIndex: 0,
  });
  t.equal(result.frozen, true);
  t.ok(result.pendingEdit !== null, "has pendingEdit");
  if (result.pendingEdit !== null) {
    t.equal(result.pendingEdit.draftBefore, "Hello team. ");
    t.match(result.pendingEdit.instructions, /make it formal/);
  }
  t.end();
});

t.test("LLM result in appliedEdits replaces the draft", (t) => {
  const transcript =
    "Hello team. start edit make it formal end edit talk soon.";
  const matches = matchesFor(transcript);
  // Find the start-edit and end-edit matches to recover the cache key.
  const startMatch = matches.find((m) => m.label === "start-edit");
  const endMatch = matches.find((m) => m.label === "end-edit");
  if (!startMatch || !endMatch) {
    t.fail("expected start-edit and end-edit matches");
    return t.end();
  }
  const key = `${startMatch.end}-${endMatch.start}`;
  const applied = new Map<string, string>([[key, "Greetings, team."]]);
  const result = deriveDraftState({
    transcript,
    matches,
    appliedEdits: applied,
    modeStartIndex: 0,
  });
  t.equal(result.frozen, false);
  t.equal(result.draft, "Greetings, team. talk soon.");
  t.end();
});

t.test("cancel edit drops the in-progress instructions", (t) => {
  const transcript = "Hi. start edit nope cancel edit how are you";
  const result = deriveDraftState({
    transcript,
    matches: matchesFor(transcript),
    appliedEdits: new Map(),
    modeStartIndex: 0,
  });
  t.equal(result.editing, null);
  t.equal(result.frozen, false);
  // Pre-edit text plus post-cancel text, edit instructions discarded.
  t.equal(result.draft, "Hi.  how are you");
  t.end();
});

t.test("end edit without start edit is inert", (t) => {
  const transcript = "Hello end edit world";
  const result = deriveDraftState({
    transcript,
    matches: matchesFor(transcript),
    appliedEdits: new Map(),
    modeStartIndex: 0,
  });
  t.equal(result.frozen, false);
  t.equal(result.editing, null);
  // Both halves of the text are part of the draft; the keyword span
  // itself isn't appended.
  t.equal(result.draft, "Hello  world");
  t.end();
});

t.test("clean up text freezes with a cleanup pending edit", (t) => {
  const transcript = "their going home clean up text";
  const result = deriveDraftState({
    transcript,
    matches: matchesFor(transcript),
    appliedEdits: new Map(),
    modeStartIndex: 0,
  });
  t.equal(result.frozen, true);
  t.ok(result.pendingEdit !== null);
  if (result.pendingEdit !== null) {
    t.equal(result.pendingEdit.kind, "cleanup");
    t.equal(result.pendingEdit.draftBefore, "their going home ");
  }
  t.end();
});

t.test("cleanup result in appliedEdits replaces the draft", (t) => {
  const transcript = "their going home clean up text talk soon.";
  const matches = matchesFor(transcript);
  const cleanupMatch = matches.find((m) => m.label === "clean-up-text");
  if (!cleanupMatch) {
    t.fail("expected clean-up-text match");
    return t.end();
  }
  const key = `cleanup-${cleanupMatch.start}-${cleanupMatch.end}`;
  const applied = new Map<string, string>([
    [key, "They're going home."],
  ]);
  const result = deriveDraftState({
    transcript,
    matches,
    appliedEdits: applied,
    modeStartIndex: 0,
  });
  t.equal(result.frozen, false);
  t.equal(result.draft, "They're going home. talk soon.");
  t.end();
});

t.test("clean up text mid-edit-instructions is inert", (t) => {
  const transcript = "Hi. start edit clean up text make it formal end edit";
  const result = deriveDraftState({
    transcript,
    matches: matchesFor(transcript),
    appliedEdits: new Map(),
    modeStartIndex: 0,
  });
  // Walker freezes on the end-edit because the instructions span includes
  // "clean up text" as ordinary text — there's no cleanup pending edit.
  t.equal(result.frozen, true);
  if (result.pendingEdit !== null) {
    t.equal(result.pendingEdit.kind, "edit");
    if (result.pendingEdit.kind === "edit") {
      t.match(result.pendingEdit.instructions, /make it formal/);
    }
  }
  t.end();
});
