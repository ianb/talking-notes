import type { SynthesisResult } from "../types.js";
import { renderMarkdown } from "../utils/markdown.js";

interface Props {
  result: SynthesisResult;
}

export function AnnotatedDocumentView({ result }: Props) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">
      {result.annotatedSegments.map(({ segment, annotations }) => (
        <div key={segment.id}>
          <div
            className="segment-block"
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(segment.markdown),
            }}
          />
          {annotations.length > 0 && (
            <div className="ml-4 pl-4 border-l-2 border-amber-500/50 space-y-2 my-2">
              {annotations.map((ann) => (
                <div key={ann.transcriptId} className="text-sm">
                  <p className="text-amber-300 italic">
                    {ann.cleanedTranscript}
                  </p>
                  {ann.quotedText && (
                    <blockquote className="text-gray-500 text-xs mt-1 pl-2 border-l border-gray-600">
                      {ann.quotedText}
                    </blockquote>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
