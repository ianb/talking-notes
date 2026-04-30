import type { ModeDef } from "../types.js";
import { EDIT_KEYWORDS } from "./keywords.js";
import { EditView } from "./EditView.js";

export const EDIT_MODE: ModeDef = {
  id: "edit",
  name: "Edit",
  description:
    "Compose messages by dictation; bracket edits with 'start edit … end edit' to rewrite via the LLM.",
  spokenAliases: ["edit", "editing", "compose"],
  keywords: EDIT_KEYWORDS,
  View: EditView,
};
