import type { SynthesisResult } from "../types.js";

interface Props {
  result: SynthesisResult;
}

export function StatementsView({ result }: Props) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      {result.statements.map((stmt, i) => (
        <div key={i} className="space-y-2">
          <p className="text-gray-100">{stmt.text}</p>
          {stmt.quotes.map((q, j) => (
            <blockquote
              key={j}
              className="ml-4 pl-4 border-l-2 border-blue-500/50 text-gray-400 text-sm italic"
            >
              {q.text}
            </blockquote>
          ))}
          {stmt.classification === "aside" && (
            <span className="text-xs text-gray-600 uppercase tracking-wide">
              aside
            </span>
          )}
        </div>
      ))}
      {result.statements.length === 0 && (
        <p className="text-gray-500 text-center">No statements captured.</p>
      )}
    </div>
  );
}
