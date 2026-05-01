import { useCallback } from "react";
import { useReadingState } from "../state.js";
import { useApiKeys } from "../../../apiKeys.js";
import { useLiveTranscription } from "../../../hooks/useLiveTranscription.js";
import { useScrollTracker } from "../hooks/useScrollTracker.js";
import { useSelectionTracker } from "../hooks/useSelectionTracker.js";
import { DocumentView } from "./DocumentView.js";
import { ReadingToolbar } from "./ReadingToolbar.js";
import { EventFeed } from "./EventFeed.js";
import { SelectionAddButton } from "./SelectionAddButton.js";

export function ReadingScreen() {
  const { state, dispatch } = useReadingState();
  const { transcriptionKey } = useApiKeys();

  // The shared transcription hook is timing-agnostic; we stamp deltas with
  // a reading-relative time here, where readingStartTime lives.
  const readingStartTime = state.readingStartTime;
  const onDelta = useCallback(
    (delta: string) =>
      dispatch({
        type: "APPEND_TRANSCRIPT_DELTA",
        delta,
        time: Date.now() - (readingStartTime ?? 0),
      }),
    [dispatch, readingStartTime],
  );

  const onDone = useCallback(
    (text?: string) => dispatch({ type: "FINALIZE_TRANSCRIPT", text }),
    [dispatch],
  );

  const onScroll = useCallback(
    (visibleSegmentIds: string[], time: number) =>
      dispatch({ type: "ADD_SCROLL", time, visibleSegmentIds }),
    [dispatch],
  );

  const { status: transcriptionStatus, error: transcriptionError } =
    useLiveTranscription({
      apiKey: transcriptionKey === null ? "" : transcriptionKey,
      enabled: state.phase === "reading" && transcriptionKey !== null,
      onDelta,
      onDone,
    });

  useScrollTracker({
    enabled: state.phase === "reading",
    readingStartTime: state.readingStartTime!,
    onScroll,
  });

  const { selection, clear } = useSelectionTracker(state.phase === "reading");

  function handleAddSelection() {
    if (!selection || !state.readingStartTime) return;
    dispatch({
      type: "ADD_SELECTION",
      time: Date.now() - state.readingStartTime,
      segmentId: selection.segmentId,
      text: selection.text,
    });
    clear();
  }

  if (!state.document) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <ReadingToolbar
        status={transcriptionStatus}
        error={transcriptionError}
      />
      <div className="pt-16 flex">
        <div className="flex-1 min-w-0 pb-16">
          <DocumentView document={state.document} />
        </div>
        <aside className="w-96 shrink-0 border-l border-gray-800 bg-gray-900/40 h-[calc(100vh-4rem)] sticky top-16">
          <EventFeed events={state.events} document={state.document} />
        </aside>
      </div>
      {selection ? <SelectionAddButton selection={selection} onAdd={handleAddSelection} /> : null}
    </div>
  );
}
