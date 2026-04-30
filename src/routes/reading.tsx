import { createFileRoute } from "@tanstack/react-router";
import { ReadingApp } from "../demos/reading/ReadingApp.js";

export const Route = createFileRoute("/reading")({
  component: ReadingApp,
});
