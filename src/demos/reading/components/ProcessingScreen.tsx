import { useEffect, useRef } from "react";
import { useReadingState } from "../state.js";
import { useApiKeys } from "../../../apiKeys.js";
import { synthesize } from "../api/synthesize.js";

export function ProcessingScreen() {
  const { state, dispatch } = useReadingState();
  const { openai } = useApiKeys();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    if (!state.document || !openai) return;
    startedRef.current = true;

    dispatch({ type: "SET_PROCESSING_STATUS", status: "Analyzing your reading session…" });

    synthesize({ apiKey: openai, document: state.document, events: state.events })
      .then((result) => {
        dispatch({ type: "SET_SYNTHESIS_RESULT", result });
      })
      .catch((err) => {
        console.error("Synthesis failed:", err);
        dispatch({ type: "SET_ERROR", error: String(err) });
        dispatch({
          type: "SET_PROCESSING_STATUS",
          status: `Error: ${err instanceof Error ? err.message : String(err)}`,
        });
      });
  }, [state.document, openai, state.events, dispatch]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
      <div className="text-center space-y-4">
        {!state.error ? (
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        ) : (
          <div className="w-12 h-12 text-red-500 mx-auto text-4xl">!</div>
        )}
        <p className="text-gray-300">{state.processingStatus ?? "Processing…"}</p>
        {state.error ? <button
            onClick={() => dispatch({ type: "RESET" })}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors"
          >
            Start Over
          </button> : null}
      </div>
    </div>
  );
}
