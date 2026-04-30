import { createFileRoute } from "@tanstack/react-router";
import { SpotterApp } from "../demos/spotter/SpotterApp.js";

export const Route = createFileRoute("/spotter")({
  component: SpotterApp,
});
