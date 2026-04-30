import { useMemo } from "react";
import type { KeywordMatch, KeywordLabel } from "../keywords.js";

interface MatchListProps {
  matches: KeywordMatch[];
}

const LABEL_DOT: Record<KeywordLabel, string> = {
  highlight: "bg-yellow-400",
  bookmark: "bg-blue-400",
  todo: "bg-green-400",
  important: "bg-red-400",
  next: "bg-purple-400",
};

export function MatchList({ matches }: MatchListProps) {
  const counts = useMemo(() => {
    const out: Partial<Record<KeywordLabel, number>> = {};
    for (const m of matches) out[m.label] = (out[m.label] ?? 0) + 1;
    return out;
  }, [matches]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
          Detected
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          {matches.length} match{matches.length === 1 ? "" : "es"}
        </p>
      </div>

      <div className="px-4 py-3 border-b border-gray-800 space-y-1.5">
        {(Object.keys(LABEL_DOT) as KeywordLabel[]).map((label) => (
          <div key={label} className="flex items-center gap-2 text-sm">
            <span
              className={`w-2.5 h-2.5 rounded-full ${LABEL_DOT[label]}`}
            />
            <span className="text-gray-300 flex-1">{label}</span>
            <span className="text-gray-500 tabular-nums">
              {counts[label] ?? 0}
            </span>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {matches.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-600 italic">
            No matches yet.
          </p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {matches.map((m, i) => (
              <li
                key={`${m.start}-${i}`}
                className="px-4 py-2 flex items-baseline gap-2"
              >
                <span
                  className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${LABEL_DOT[m.label]}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-wider text-gray-500">
                    {m.label}
                  </div>
                  <div className="text-sm text-gray-200 truncate">{m.text}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
