/**
 * Build the always-active mode-switch keyword set from the registered
 * modes. Each target mode gets its own `(enter | switch to | go to) <X>`
 * pattern with all of its spoken aliases as alternatives. The canonical
 * phrase displayed in the keyword panel is `enter <first-alias>`.
 *
 * Mode names are interpolated into the pattern source as raw text. That's
 * safe here because aliases are author-controlled strings (declared on
 * each ModeDef), not user input — but if that ever changes, sanitize
 * before composing.
 */

import { KeywordPattern } from "../utils/patmatch.js";
import type { KeywordColorClasses, ModeDef, ModeSwitchKeyword } from "./types.js";

const MODE_SWITCH_COLORS: KeywordColorClasses = {
  highlight: "bg-cyan-500/30 text-cyan-100 border-cyan-500/60",
  dot: "bg-cyan-400",
};

export function buildSwitchKeywords(
  modes: readonly ModeDef[],
): ModeSwitchKeyword[] {
  const result: ModeSwitchKeyword[] = [];
  for (const mode of modes) {
    const aliases = mode.spokenAliases;
    if (aliases.length === 0) continue;
    const aliasesPat = aliases.join(" | ");
    const patternSource = `
      (enter | switch to | go to | activate) (${aliasesPat}) (mode)?
    `;
    const firstAlias = aliases[0];
    if (firstAlias === undefined) continue;
    result.push({
      targetModeId: mode.id,
      canonical: `enter ${firstAlias}`,
      pattern: KeywordPattern.compile(patternSource),
      colorClasses: MODE_SWITCH_COLORS,
    });
  }
  return result;
}

export function getModeSwitchColors(): KeywordColorClasses {
  return MODE_SWITCH_COLORS;
}
