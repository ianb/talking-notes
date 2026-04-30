import t from "tap";
import { renderMarkdown } from "../../../src/demos/reading/utils/markdown.js";

t.test("renders a paragraph", (t) => {
  const html = renderMarkdown("Hello world");
  t.match(html, /<p>Hello world<\/p>/);
  t.end();
});

t.test("renders a heading", (t) => {
  const html = renderMarkdown("## Subheading");
  t.match(html, /<h2.*>Subheading<\/h2>/);
  t.end();
});

t.test("renders bold text", (t) => {
  const html = renderMarkdown("This is **bold**");
  t.match(html, /<strong>bold<\/strong>/);
  t.end();
});

t.test("renders links", (t) => {
  const html = renderMarkdown("[click](https://example.com)");
  t.match(html, /href="https:\/\/example\.com"/);
  t.end();
});

t.test("renders code blocks", (t) => {
  const html = renderMarkdown("```\ncode here\n```");
  t.match(html, /<code>/);
  t.end();
});
