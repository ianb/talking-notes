/**
 * Cheat-sheet panel showing every keyword phrase the user can say in the
 * current mode, plus the always-on mode-switch phrases. This is a static
 * surface — it doesn't react to matches; that's TranscriptView's job.
 */

import type { KeywordDef, ModeSwitchKeyword } from "../modes/types.js";

interface KeywordPanelProps {
  modeName: string;
  modeKeywords: readonly KeywordDef[];
  switchKeywords: readonly ModeSwitchKeyword[];
  currentModeId: string;
}

export function KeywordPanel({
  modeName,
  modeKeywords,
  switchKeywords,
  currentModeId,
}: KeywordPanelProps) {
  const otherSwitches = switchKeywords.filter(
    (sw) => sw.targetModeId !== currentModeId,
  );

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-800">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
          Say one of these
        </h2>
        <p className="text-xs text-gray-500 mt-1">{modeName} mode</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <ul className="divide-y divide-gray-800">
          {modeKeywords.map((def) => (
            <li key={def.label} className="px-6 py-3">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${def.colorClasses.dot}`}
                />
                <span className="font-medium text-gray-200">
                  {def.canonical}
                </span>
              </div>
              {def.description === null ? null : (
                <p className="text-xs text-gray-500 mt-1 ml-4.5 pl-0.5">
                  {def.description}
                </p>
              )}
            </li>
          ))}
        </ul>

        {otherSwitches.length === 0 ? null : (
          <>
            <div className="px-6 py-3 border-t border-gray-800 mt-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Switch mode
              </h3>
            </div>
            <ul className="divide-y divide-gray-800">
              {otherSwitches.map((sw) => (
                <li key={sw.targetModeId} className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${sw.colorClasses.dot}`}
                    />
                    <span className="font-medium text-gray-200">
                      {sw.canonical}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
