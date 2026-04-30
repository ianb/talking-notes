import type { ParsedDocument } from "../types.js";
import { SegmentBlock } from "./SegmentBlock.js";

interface DocumentViewProps {
  document: ParsedDocument;
}

export function DocumentView({ document }: DocumentViewProps) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {document.segments.map((segment) => (
        <SegmentBlock key={segment.id} segment={segment} />
      ))}
    </div>
  );
}
