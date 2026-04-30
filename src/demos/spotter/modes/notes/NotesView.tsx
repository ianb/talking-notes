/**
 * Notes mode view. The transcript itself (rendered by the shell) does
 * the heavy lifting — this panel is a running tally of what's been
 * spotted, by label, plus a list of matched spans for quick scanning.
 */

import { useMemo } from "react";
import type { KeywordDef, ModeMatch, ModeViewProps } from "../types.js";
import { NOTES_KEYWORDS } from "./keywords.js";

interface FilterArgs {
  modeId: string;
  startIndex: number;
}

function filterToMode(
  matches: ModeMatch[],
  { modeId, startIndex }: FilterArgs,
): ModeMatch[] {
  return matches.filter((m) => m.modeId === modeId && m.start >= startIndex);
}

export function NotesView({ matches, modeStartIndex }: ModeViewProps) {
  const ownMatches = useMemo(
    () => filterToMode(matches, { modeId: "notes", startIndex: modeStartIndex }),
    [matches, modeStartIndex],
  );

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const m of ownMatches) {
      const prev = out[m.label];
      out[m.label] = (prev === undefined ? 0 : prev) + 1;
    }
    return out;
  }, [ownMatches]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-800">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
          Detected
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          {ownMatches.length} match{ownMatches.length === 1 ? "" : "es"}
        </p>
      </div>

      <div className="px-6 py-3 border-b border-gray-800 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {NOTES_KEYWORDS.map((def: KeywordDef) => (
          <div key={def.label} className="flex items-center gap-2 text-sm">
            <span
              className={`w-2.5 h-2.5 rounded-full ${def.colorClasses.dot}`}
            />
            <span className="text-gray-300 flex-1">{def.canonical}</span>
            <span className="text-gray-500 tabular-nums">
              {counts[def.label] === undefined ? 0 : counts[def.label]}
            </span>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {ownMatches.length === 0 ? (
          <p className="px-6 py-6 text-sm text-gray-600 italic">
            No matches yet. Try saying one of the keywords above.
          </p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {ownMatches.map((m, i) => (
              <li
                key={`${m.start}-${i}`}
                className="px-6 py-2 flex items-baseline gap-2"
              >
                <span
                  className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${m.colorClasses.dot}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-wider text-gray-500">
                    {m.canonical}
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
