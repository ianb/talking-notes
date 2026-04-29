import type { DocumentSegment, ParsedDocument } from "../types.js";

function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/!\[.*?\]\(.+?\)/g, "")
    .replace(/>\s?/gm, "")
    .trim();
}

function extractTitle(markdown: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  if (match?.[1]) return match[1].trim();
  const firstLine = markdown.trim().split("\n")[0] ?? "";
  return stripMarkdown(firstLine).slice(0, 80) || "Untitled";
}

export function parseDocument(
  rawMarkdown: string,
  sourceUrl?: string,
): ParsedDocument {
  const segments: DocumentSegment[] = [];
  const blocks = rawMarkdown.split(/\n\n+/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    segments.push({
      id: `seg-${segments.length}`,
      index: segments.length,
      markdown: trimmed,
      plainText: stripMarkdown(trimmed),
    });
  }

  return {
    title: extractTitle(rawMarkdown),
    sourceUrl,
    rawMarkdown,
    segments,
  };
}
