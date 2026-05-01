import { createFileRoute } from "@tanstack/react-router";
import { LanguageLearningApp } from "../demos/language-learning/LanguageLearningApp.js";

export const Route = createFileRoute("/language-learning")({
  component: LanguageLearningApp,
});
