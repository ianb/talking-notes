import { useAppState } from "../state.js";
import type { LiveTranscriptionStatus } from "../hooks/useLiveTranscription.js";

interface ReadingToolbarProps {
  status: LiveTranscriptionStatus;
  error: string | null;
}

export function ReadingToolbar({ status, error }: ReadingToolbarProps) {
  const { dispatch } = useAppState();

  function handleComplete() {
    dispatch({ type: "START_PROCESSING" });
  }

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
          ? `Error: ${error ?? "unknown"}`
          : "Idle";

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-gray-900/95 border-b border-gray-700 backdrop-blur-sm">
      <div className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${dot}`} />
          <span className="text-sm text-gray-300">{label}</span>
        </div>
        <button
          onClick={handleComplete}
          className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Complete
        </button>
      </div>
    </div>
  );
}
