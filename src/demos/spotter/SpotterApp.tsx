import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useApiKeys } from "../../apiKeys.js";
import { useLiveTranscription } from "../../hooks/useLiveTranscription.js";
import { findKeywordMatches } from "./keywords.js";
import { TranscriptView } from "./components/TranscriptView.js";
import { MatchList } from "./components/MatchList.js";

export function SpotterApp() {
  const { mistral } = useApiKeys();
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");

  const onDelta = useCallback((delta: string) => {
    setTranscript((current) => current + delta);
  }, []);

  // Voxtral emits a `transcription.done` at the end of an utterance; we
  // don't need it for spotting (matching is incremental on each delta),
  // so just no-op.
  const onDone = useCallback(() => {}, []);

  const apiKey = mistral ?? "";
  const { status, error } = useLiveTranscription({
    apiKey,
    enabled: recording && !!mistral,
    onDelta,
    onDone,
  });

  const matches = useMemo(() => findKeywordMatches(transcript), [transcript]);

  // Auto-scroll the transcript pane as new text streams in.
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [transcript]);

  function handleStart() {
    setTranscript("");
    setRecording(true);
  }
  function handleStop() {
    setRecording(false);
  }
  function handleClear() {
    setTranscript("");
  }

  if (!mistral) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Spotter</h1>
          <p className="text-gray-400">
            This demo needs a Mistral API key for live transcription.
          </p>
          <Link
            to="/"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium"
          >
            Set API key
          </Link>
        </div>
      </div>
    );
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
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
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
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClear}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm rounded-lg transition-colors"
            >
              Clear
            </button>
            {recording ? (
              <button
                onClick={handleStop}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={handleStart}
                className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Start
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="pt-16 flex flex-1 min-h-0">
        <div
          ref={transcriptRef}
          className="flex-1 min-w-0 overflow-y-auto px-6 py-6 max-w-4xl mx-auto"
        >
          <TranscriptView transcript={transcript} matches={matches} />
        </div>
        <aside className="w-80 shrink-0 border-l border-gray-800 bg-gray-900/40 sticky top-16 h-[calc(100vh-4rem)]">
          <MatchList matches={matches} />
        </aside>
      </div>
    </div>
  );
}
