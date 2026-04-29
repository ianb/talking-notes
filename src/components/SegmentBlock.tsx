import type { DocumentSegment } from "../types.js";
import { renderMarkdown } from "../utils/markdown.js";

interface SegmentBlockProps {
  segment: DocumentSegment;
}

export function SegmentBlock({ segment }: SegmentBlockProps) {
  return (
    <div
      data-segment-id={segment.id}
      className="segment-block"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(segment.markdown) }}
    />
  );
}
