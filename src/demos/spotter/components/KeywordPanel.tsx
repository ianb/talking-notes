/**
 * Cheat-sheet panel showing every keyword phrase the user can say in the
 * current mode, plus the always-on mode-switch phrases. This is a static
 * surface — it doesn't react to matches; that's TranscriptView's job.
 *
 * Layout is intentionally compact (one line per phrase, no inline
 * descriptions) because edit mode + the switch keywords would otherwise
 * push the bottom of the list off-screen on smaller viewports. Each
 * row's `title` attribute carries the longer description as a hover
 * tooltip.
 */

import type { KeywordDef, ModeSwitchKeyword } from "../modes/types.js";

interface KeywordPanelProps {
  modeKeywords: readonly KeywordDef[];
  switchKeywords: readonly ModeSwitchKeyword[];
  currentModeId: string;
}

export function KeywordPanel({
  modeKeywords,
  switchKeywords,
  currentModeId,
}: KeywordPanelProps) {
  const otherSwitches = switchKeywords.filter(
    (sw) => sw.targetModeId !== currentModeId,
  );

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2.5 border-b border-gray-800">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Say one of these
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <ul className="divide-y divide-gray-800/60">
          {modeKeywords.map((def) => (
            <li
              key={def.label}
              title={def.description ?? undefined}
              className="px-4 py-1.5 flex items-center gap-2"
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${def.colorClasses.dot}`}
              />
              <span className="text-sm text-gray-200">{def.canonical}</span>
            </li>
          ))}
        </ul>

        {otherSwitches.length === 0 ? null : (
          <>
            <div className="px-4 py-1.5 border-t border-gray-800 bg-gray-900/40">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Switch mode
              </h3>
            </div>
            <ul className="divide-y divide-gray-800/60">
              {otherSwitches.map((sw) => (
                <li
                  key={sw.targetModeId}
                  className="px-4 py-1.5 flex items-center gap-2"
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${sw.colorClasses.dot}`}
                  />
                  <span className="text-sm text-gray-200">{sw.canonical}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
