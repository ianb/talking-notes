/**
 * Shell for the spotter experience. Owns the live transcription stream
 * and the active mode; mounts whichever mode View is current. Modes can
 * be switched two ways:
 *
 *  - By voice: any `enter <mode-name>` / `switch to <mode-name>`
 *    keyword in the transcript flips the active mode. A watermark ref
 *    tracks the latest switch we've already honored so we don't re-fire
 *    on unrelated transcript updates.
 *  - By UI: clicking a mode button.
 *
 * State-transition rules — explicitly chosen, easy to get wrong:
 *
 *  - Mode change (either trigger) clears the transcript, so each mode
 *    session starts fresh. Switching to the mode you're already in is
 *    a no-op.
 *  - Start clears the transcript and turns on the mic, but **does not
 *    change the mode** — the user picks the mode and that sticks across
 *    Start/Stop cycles.
 *  - Stop turns off the mic and clears any in-flight interim text. It
 *    leaves the committed transcript and the active mode alone.
 *  - Clear empties the transcript and that's all — no mic change, no
 *    mode change.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useApiKeys } from "../../apiKeys.js";
import { useLiveTranscription } from "../../hooks/useLiveTranscription.js";
import { TranscriptView } from "./components/TranscriptView.js";
import { KeywordPanel } from "./components/KeywordPanel.js";
import { findMatches } from "./modes/findMatches.js";
import { buildSwitchKeywords } from "./modes/modeSwitch.js";
import { DEFAULT_MODE_ID, MODES, findMode } from "./modes/registry.js";
import { META_MODE_ID, type ModeMatch } from "./modes/types.js";

const SWITCH_KEYWORDS = buildSwitchKeywords(MODES);

interface ActiveMode {
  id: string;
  /**
   * Char index into `transcript` where this mode's session started.
   * After we adopted clear-on-switch this is always 0 in practice, but
   * the field stays in `ModeViewProps` so mode views don't have to be
   * touched whenever the transition policy moves.
   */
  startIndex: number;
}

function findLatestVoiceSwitch(matches: ModeMatch[]): ModeMatch | null {
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    if (m && m.modeId === META_MODE_ID && m.targetModeId !== null) return m;
  }
  return null;
}

export function SpotterApp() {
  const { transcriptionKey, provider } = useApiKeys();
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [activeMode, setActiveMode] = useState<ActiveMode>({
    id: DEFAULT_MODE_ID,
    startIndex: 0,
  });

  const onDelta = useCallback((delta: string) => {
    setTranscript((current) => current + delta);
    // The just-finalized text supersedes whatever was being interim'd.
    setInterim("");
  }, []);
  const onInterim = useCallback((text: string) => {
    setInterim(text);
  }, []);
  const onDone = useCallback(() => {}, []);

  const apiKey = transcriptionKey === null ? "" : transcriptionKey;
  const { status, error } = useLiveTranscription({
    apiKey,
    enabled: recording && transcriptionKey !== null,
    onDelta,
    onInterim,
    onDone,
  });

  // Pass 1: scan the transcript with only the meta switch patterns so
  // we can react to voice-triggered mode switches. We honor each match
  // at most once via `lastHonoredSwitchEndRef`; the watermark resets
  // whenever the transcript is empty (a fresh session can re-fire).
  const switchMatches = useMemo(
    () =>
      findMatches(transcript, {
        modeKeywords: [],
        modeId: META_MODE_ID,
        switchKeywords: SWITCH_KEYWORDS,
      }),
    [transcript],
  );

  const lastHonoredSwitchEndRef = useRef(-1);
  useEffect(() => {
    if (transcript.length === 0) lastHonoredSwitchEndRef.current = -1;
  }, [transcript]);

  // Apply mode transitions through a single helper so manual clicks
  // and voice triggers share the same behavior (and the same setState
  // batch).
  const applyModeChange = useCallback((targetId: string) => {
    setActiveMode({ id: targetId, startIndex: 0 });
    setTranscript("");
    setInterim("");
  }, []);

  // Honor voice mode-switches as they appear in the transcript. This
  // effect synchronizes app state with an external signal (the
  // transcription stream) — exactly the case the React docs cite for
  // setState-in-effect. The watermark guards against re-fires, and
  // applyModeChange itself is idempotent.
  useEffect(() => {
    const latest = findLatestVoiceSwitch(switchMatches);
    if (latest === null) return;
    if (latest.targetModeId === null) return;
    if (latest.end <= lastHonoredSwitchEndRef.current) return;
    lastHonoredSwitchEndRef.current = latest.end;
    if (latest.targetModeId === activeMode.id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    applyModeChange(latest.targetModeId);
  }, [switchMatches, activeMode.id, applyModeChange]);

  const safeMode = useMemo(() => {
    const found = findMode(activeMode.id);
    return found === null ? MODES[0] : found;
  }, [activeMode.id]);

  // Pass 2: full match set including the active mode's keywords. We
  // include the switch keywords again so they highlight in the
  // transcript view.
  const matches = useMemo(
    () =>
      findMatches(transcript, {
        modeKeywords: safeMode.keywords,
        modeId: safeMode.id,
        switchKeywords: SWITCH_KEYWORDS,
      }),
    [transcript, safeMode.id, safeMode.keywords],
  );

  // Decorative match set for the interim text — same patterns, but the
  // results are display-only. Mode views, mode-switching, and edit-mode
  // dispatch all read `matches` (the committed set), so a keyword that
  // appears in `interim` does not trigger any action until the next
  // delta finalizes it.
  const interimMatches = useMemo(() => {
    if (interim.length === 0) return [];
    return findMatches(interim, {
      modeKeywords: safeMode.keywords,
      modeId: safeMode.id,
      switchKeywords: SWITCH_KEYWORDS,
    });
  }, [interim, safeMode.id, safeMode.keywords]);

  const transcriptRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = transcriptRef.current;
    if (el === null) return;
    el.scrollTop = el.scrollHeight;
  }, [transcript, interim]);

  function handleStart() {
    setTranscript("");
    setInterim("");
    setRecording(true);
  }
  function handleStop() {
    setRecording(false);
    setInterim("");
  }
  function handleClear() {
    setTranscript("");
    setInterim("");
  }
  function handleSelectMode(modeId: string) {
    if (modeId === activeMode.id) return;
    applyModeChange(modeId);
  }

  if (transcriptionKey === null) return <NeedsKey provider={provider} />;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <Header
        modeName={safeMode.name}
        activeModeId={activeMode.id}
        onSelectMode={handleSelectMode}
        recording={recording}
        status={status}
        statusError={error}
        onStart={handleStart}
        onStop={handleStop}
        onClear={handleClear}
      />

      <div className="pt-32 flex flex-col flex-1 min-h-0">
        <div
          ref={transcriptRef}
          className="h-[26vh] min-h-[180px] border-b border-gray-800 overflow-y-auto px-6 py-4 bg-gray-950"
        >
          <TranscriptView
            transcript={transcript}
            matches={matches}
            interim={interim}
            interimMatches={interimMatches}
          />
        </div>

        <div className="flex flex-1 min-h-0">
          <main className="flex-1 min-w-0 overflow-y-auto">
            <safeMode.View
              transcript={transcript}
              matches={matches}
              modeStartIndex={activeMode.startIndex}
            />
          </main>
          <aside className="w-80 shrink-0 border-l border-gray-800 bg-gray-900/40">
            <KeywordPanel
              modeName={safeMode.name}
              modeKeywords={safeMode.keywords}
              switchKeywords={SWITCH_KEYWORDS}
              currentModeId={safeMode.id}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

interface HeaderProps {
  modeName: string;
  activeModeId: string;
  onSelectMode: (id: string) => void;
  recording: boolean;
  status: string;
  statusError: string | null;
  onStart: () => void;
  onStop: () => void;
  onClear: () => void;
}

function Header({
  modeName,
  activeModeId,
  onSelectMode,
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
          <h1 className="text-lg font-semibold">Spotter</h1>
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

function NeedsKey({ provider }: { provider: "voxtral" | "deepgram" }) {
  const providerLabel = provider === "voxtral" ? "Mistral (Voxtral)" : "Deepgram";
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold">Spotter</h1>
        <p className="text-gray-400">
          This demo needs a {providerLabel} API key for live transcription
          (you can switch providers on the home screen), plus an OpenAI key
          for edit and language-learning modes.
        </p>
        <Link
          to="/"
          className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium"
        >
          Set API keys
        </Link>
      </div>
    </div>
  );
}
