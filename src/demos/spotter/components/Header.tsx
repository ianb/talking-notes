/**
 * Top bar for the spotter shell. Shows the recording status and active
 * voice provider, the mode-switcher tabs, and the start/stop/clear
 * controls. The provider chip links to the home screen because that's
 * where the user can switch providers.
 */

import { Link } from "@tanstack/react-router";
import type { TranscriptionProvider } from "../../../apiKeys.js";
import { MODES } from "../modes/registry.js";

interface HeaderProps {
  modeName: string;
  activeModeId: string;
  onSelectMode: (id: string) => void;
  recording: boolean;
  status: string;
  statusError: string | null;
  provider: TranscriptionProvider;
  onStart: () => void;
  onStop: () => void;
  onClear: () => void;
}

const PROVIDER_DISPLAY: Record<TranscriptionProvider, string> = {
  voxtral: "Voxtral",
  deepgram: "Deepgram",
};

const PROVIDER_PILL: Record<TranscriptionProvider, string> = {
  voxtral: "bg-amber-900/40 border-amber-800/60 text-amber-200",
  deepgram: "bg-indigo-900/40 border-indigo-800/60 text-indigo-200",
};

export function Header({
  modeName,
  activeModeId,
  onSelectMode,
  recording,
  status,
  statusError,
  provider,
  onStart,
  onStop,
  onClear,
}: HeaderProps) {
  const dot =
    status === "recording"
      ? "bg-red-500 animate-pulse"
      : status === "connecting"
        ? "bg-yellow-500 animate-pulse"
        : status === "error"
          ? "bg-red-700"
          : "bg-gray-600";

  const label =
    status === "recording"
      ? "Recording"
      : status === "connecting"
        ? "Connecting…"
        : status === "error"
          ? `Error: ${statusError === null ? "unknown" : statusError}`
          : "Idle";

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-gray-900/95 border-b border-gray-700 backdrop-blur-sm">
      <div className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-gray-400 hover:text-gray-200 text-sm">
            ←
          </Link>
          <h1 className="text-lg font-semibold">Spotter</h1>
          <span className="text-gray-600">·</span>
          <div className={`w-3 h-3 rounded-full ${dot}`} />
          <span className="text-sm text-gray-300">{label}</span>
          <Link
            to="/"
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${PROVIDER_PILL[provider]}`}
            title="Voice provider — change on the home screen"
          >
            {PROVIDER_DISPLAY[provider]}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClear}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm rounded-lg transition-colors"
          >
            Clear
          </button>
          {recording ? (
            <button
              onClick={onStop}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={onStart}
              className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Start
            </button>
          )}
        </div>
      </div>
      <div className="px-6 pb-3 flex items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-gray-500 mr-1">
          Mode:
        </span>
        {MODES.map((m) => {
          const active = m.id === activeModeId;
          return (
            <button
              key={m.id}
              onClick={() => onSelectMode(m.id)}
              className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                active
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
              }`}
              title={m.description}
            >
              {m.name}
            </button>
          );
        })}
        <span className="text-xs text-gray-500 ml-2">{modeName}</span>
      </div>
    </header>
  );
}
