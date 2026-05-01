/**
 * Top bar for the language-learning demo. Shows the recording status,
 * a fixed-language pill (Spanish), and the start / stop / clear
 * controls.
 */

import { Link } from "@tanstack/react-router";

interface HeaderProps {
  recording: boolean;
  status: string;
  statusError: string | null;
  onStart: () => void;
  onStop: () => void;
  onClear: () => void;
}

export function Header({
  recording,
  status,
  statusError,
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
          <h1 className="text-lg font-semibold">Language Learning</h1>
          <span className="text-gray-600">·</span>
          <span className="text-xs uppercase tracking-wider text-gray-400">
            Spanish
          </span>
          <span className="text-gray-600">·</span>
          <div className={`w-3 h-3 rounded-full ${dot}`} />
          <span className="text-sm text-gray-300">{label}</span>
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
    </header>
  );
}
