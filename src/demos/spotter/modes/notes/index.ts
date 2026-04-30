import type { ModeDef } from "../types.js";
import { NOTES_KEYWORDS } from "./keywords.js";
import { NotesView } from "./NotesView.js";

export const NOTES_MODE: ModeDef = {
  id: "notes",
  name: "Notes",
  description:
    "Free-form transcript with keyword highlights — original spotter behavior.",
  spokenAliases: ["notes", "spotter", "highlights"],
  keywords: NOTES_KEYWORDS,
  View: NotesView,
};
