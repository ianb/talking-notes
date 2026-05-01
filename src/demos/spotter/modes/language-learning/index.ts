import type { ModeDef } from "../types.js";
import { LANGUAGE_LEARNING_KEYWORDS } from "./keywords.js";
import { LanguageLearningView } from "./LanguageLearningView.js";

export const LANGUAGE_LEARNING_MODE: ModeDef = {
  id: "language-learning",
  name: "Language learning",
  description:
    "Speak in Spanish. Bracket English questions with 'question … send', or say 'critique this' for feedback.",
  spokenAliases: ["language learning", "spanish", "tutor"],
  keywords: LANGUAGE_LEARNING_KEYWORDS,
  View: LanguageLearningView,
};
