import t from "tap";
import { KeywordPattern } from "../../../src/demos/spotter/utils/patmatch.js";
import { findMatches } from "../../../src/demos/spotter/modes/findMatches.js";
import { buildSwitchKeywords } from "../../../src/demos/spotter/modes/modeSwitch.js";
import {
  META_MODE_ID,
  type KeywordDef,
  type ModeDef,
} from "../../../src/demos/spotter/modes/types.js";

const COLORS = { highlight: "h", dot: "d" };

function def(label: string, canonical: string, src: string): KeywordDef {
  return {
    label,
    canonical,
    description: null,
    pattern: KeywordPattern.compile(src),
    colorClasses: COLORS,
  };
}

t.test("findMatches highlights mode keywords with their canonical/colors", (t) => {
  const keywords = [def("hi", "highlight", "highlight (this | that)?")];
  const result = findMatches("please highlight that part", {
    modeKeywords: keywords,
    modeId: "notes",
    switchKeywords: [],
  });
  t.equal(result.length, 1);
  const first = result[0];
  if (!first) {
    t.fail("expected one match");
    return t.end();
  }
  t.equal(first.label, "hi");
  t.equal(first.canonical, "highlight");
  t.equal(first.modeId, "notes");
  t.equal(first.text.toLowerCase().includes("highlight"), true);
  t.equal(first.targetModeId, null);
  t.end();
});

t.test("findMatches de-overlaps later patterns that overlap an earlier match", (t) => {
  const keywords = [
    def("a", "important", "this is important"),
    def("b", "important-short", "important"),
  ];
  const result = findMatches("please mark this is important now", {
    modeKeywords: keywords,
    modeId: "notes",
    switchKeywords: [],
  });
  t.equal(result.length, 1);
  const first = result[0];
  if (!first) {
    t.fail("expected one match");
    return t.end();
  }
  // The longer one starts earlier, so it wins; "important" alone is dropped.
  t.equal(first.label, "a");
  t.end();
});

t.test("findMatches surfaces switch keywords with targetModeId set", (t) => {
  const fakeMode: ModeDef = {
    id: "edit",
    name: "Edit",
    description: "",
    spokenAliases: ["edit", "editing"],
    keywords: [],
    View: () => null,
  };
  const switchKeywords = buildSwitchKeywords([fakeMode]);
  const result = findMatches("ok now switch to edit mode please", {
    modeKeywords: [],
    modeId: "notes",
    switchKeywords,
  });
  t.equal(result.length, 1);
  const first = result[0];
  if (!first) {
    t.fail("expected one match");
    return t.end();
  }
  t.equal(first.modeId, META_MODE_ID);
  t.equal(first.targetModeId, "edit");
  t.equal(first.canonical, "enter edit");
  t.end();
});

t.test("findMatches returns empty for empty/whitespace transcript", (t) => {
  const keywords = [def("hi", "highlight", "highlight")];
  t.same(findMatches("", { modeKeywords: keywords, modeId: "notes", switchKeywords: [] }), []);
  t.same(findMatches("   ", { modeKeywords: keywords, modeId: "notes", switchKeywords: [] }), []);
  t.end();
});

t.test("findMatches sorts matches by start index", (t) => {
  const keywords = [
    def("a", "first", "first"),
    def("b", "second", "second"),
  ];
  const result = findMatches("the second one came after the first one", {
    modeKeywords: keywords,
    modeId: "notes",
    switchKeywords: [],
  });
  t.equal(result.length, 2);
  const a = result[0];
  const b = result[1];
  if (!a || !b) {
    t.fail("expected two matches");
    return t.end();
  }
  t.ok(a.start < b.start, "matches sorted by start");
  // "second" comes first in the text, even though its def is second.
  t.equal(a.label, "b");
  t.equal(b.label, "a");
  t.end();
});
