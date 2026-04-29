import t from "tap";
import { parseDocument } from "../src/utils/documentParser.js";

t.test("parses markdown into segments", (t) => {
  const md = `# Hello World

This is paragraph one.

This is paragraph two.`;

  const doc = parseDocument(md);
  t.equal(doc.segments.length, 3);
  t.equal(doc.segments[0].id, "seg-0");
  t.equal(doc.segments[0].markdown, "# Hello World");
  t.equal(doc.segments[1].markdown, "This is paragraph one.");
  t.equal(doc.segments[2].markdown, "This is paragraph two.");
  t.end();
});

t.test("extracts title from first heading", (t) => {
  const doc = parseDocument("# My Article\n\nSome content.");
  t.equal(doc.title, "My Article");
  t.end();
});

t.test("falls back to first line for title when no heading", (t) => {
  const doc = parseDocument("Some plain text\n\nMore text.");
  t.equal(doc.title, "Some plain text");
  t.end();
});

t.test("assigns sequential indices", (t) => {
  const doc = parseDocument("A\n\nB\n\nC");
  t.same(
    doc.segments.map((s) => s.index),
    [0, 1, 2],
  );
  t.end();
});

t.test("strips markdown from plainText", (t) => {
  const doc = parseDocument("**bold** and *italic* and [link](url)");
  t.equal(doc.segments[0].plainText, "bold and italic and link");
  t.end();
});

t.test("skips empty blocks", (t) => {
  const doc = parseDocument("A\n\n\n\n\nB");
  t.equal(doc.segments.length, 2);
  t.end();
});

t.test("preserves sourceUrl", (t) => {
  const doc = parseDocument("Hello", "https://example.com");
  t.equal(doc.sourceUrl, "https://example.com");
  t.end();
});
