import { createContext, useContext, type Dispatch } from "react";
import type {
  AppPhase,
  ParsedDocument,
  SessionEvent,
  SynthesisResult,
} from "./types.js";

export interface AppState {
  phase: AppPhase;
  /** OpenAI API key (for synthesis). */
  apiKey: string | null;
  /** Mistral API key (for Voxtral live transcription). */
  mistralApiKey: string | null;
  document: ParsedDocument | null;
  events: SessionEvent[];
  readingStartTime: number | null;
  synthesisResult: SynthesisResult | null;
  processingStatus: string | null;
  error: string | null;
}

export type AppAction =
  | { type: "SET_API_KEY"; key: string }
  | { type: "SET_MISTRAL_API_KEY"; key: string }
  | { type: "SET_DOCUMENT"; doc: ParsedDocument }
  | { type: "START_READING" }
  | { type: "APPEND_TRANSCRIPT_DELTA"; delta: string; time: number }
  | { type: "FINALIZE_TRANSCRIPT"; text?: string }
  | { type: "ADD_SCROLL"; time: number; visibleSegmentIds: string[] }
  | { type: "ADD_SELECTION"; time: number; segmentId: string; text: string }
  | { type: "START_PROCESSING" }
  | { type: "SET_PROCESSING_STATUS"; status: string }
  | { type: "SET_SYNTHESIS_RESULT"; result: SynthesisResult }
  | { type: "SET_ERROR"; error: string }
  | { type: "RESET" };

export const initialState: AppState = {
  phase: "setup",
  apiKey: localStorage.getItem("openai-api-key"),
  mistralApiKey: localStorage.getItem("mistral-api-key"),
  document: null,
  events: [],
  readingStartTime: null,
  synthesisResult: null,
  processingStatus: null,
  error: null,
};

let transcriptCounter = 0;
let scrollCounter = 0;
let selectionCounter = 0;

function nextId(prefix: string, counter: () => number): string {
  return `${prefix}-${counter()}`;
}

/** Mark the last event as no longer pending if it's a pending transcript. */
function finalizePending(events: SessionEvent[]): SessionEvent[] {
  const last = events[events.length - 1];
  if (last?.kind === "transcript" && last.pending) {
    return [...events.slice(0, -1), { ...last, pending: false }];
  }
  return events;
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_API_KEY":
      localStorage.setItem("openai-api-key", action.key);
      return { ...state, apiKey: action.key };
    case "SET_MISTRAL_API_KEY":
      localStorage.setItem("mistral-api-key", action.key);
      return { ...state, mistralApiKey: action.key };
    case "SET_DOCUMENT":
      return { ...state, document: action.doc };
    case "START_READING":
      transcriptCounter = 0;
      scrollCounter = 0;
      selectionCounter = 0;
      return {
        ...state,
        phase: "reading",
        readingStartTime: Date.now(),
        events: [],
      };
    case "APPEND_TRANSCRIPT_DELTA": {
      const last = state.events[state.events.length - 1];
      if (last?.kind === "transcript" && last.pending) {
        const updated: SessionEvent = {
          ...last,
          text: last.text + action.delta,
          endTime: action.time,
        };
        return {
          ...state,
          events: [...state.events.slice(0, -1), updated],
        };
      }
      const id = nextId("transcript", () => transcriptCounter++);
      const newEvent: SessionEvent = {
        kind: "transcript",
        id,
        startTime: action.time,
        endTime: action.time,
        text: action.delta,
        pending: true,
      };
      return { ...state, events: [...state.events, newEvent] };
    }
    case "FINALIZE_TRANSCRIPT": {
      const last = state.events[state.events.length - 1];
      if (last?.kind === "transcript" && last.pending) {
        const updated: SessionEvent = {
          ...last,
          pending: false,
          ...(action.text ? { text: action.text } : {}),
        };
        return {
          ...state,
          events: [...state.events.slice(0, -1), updated],
        };
      }
      return state;
    }
    case "ADD_SCROLL": {
      const events = finalizePending(state.events);
      const last = events[events.length - 1];
      const newEvent: SessionEvent = {
        kind: "scroll",
        id: nextId("scroll", () => scrollCounter++),
        time: action.time,
        visibleSegmentIds: action.visibleSegmentIds,
      };
      // Drop the previous scroll if no transcript/selection arrived since
      if (last?.kind === "scroll") {
        return { ...state, events: [...events.slice(0, -1), newEvent] };
      }
      return { ...state, events: [...events, newEvent] };
    }
    case "ADD_SELECTION": {
      const events = finalizePending(state.events);
      const newEvent: SessionEvent = {
        kind: "selection",
        id: nextId("selection", () => selectionCounter++),
        time: action.time,
        segmentId: action.segmentId,
        text: action.text,
      };
      return { ...state, events: [...events, newEvent] };
    }
    case "START_PROCESSING":
      return {
        ...state,
        phase: "processing",
        events: finalizePending(state.events),
        processingStatus: "Starting synthesis…",
      };
    case "SET_PROCESSING_STATUS":
      return { ...state, processingStatus: action.status };
    case "SET_SYNTHESIS_RESULT":
      return { ...state, phase: "results", synthesisResult: action.result };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "RESET":
      return {
        ...initialState,
        apiKey: state.apiKey,
        mistralApiKey: state.mistralApiKey,
      };
  }
}

export const AppContext = createContext<{
  state: AppState;
  dispatch: Dispatch<AppAction>;
}>({ state: initialState, dispatch: () => {} });

export function useAppState() {
  return useContext(AppContext);
}
