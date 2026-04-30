import { createContext, useContext, type Dispatch } from "react";
import type {
  AppPhase,
  ParsedDocument,
  SessionEvent,
  SynthesisResult,
} from "./types.js";

export interface ReadingState {
  phase: AppPhase;
  document: ParsedDocument | null;
  events: SessionEvent[];
  readingStartTime: number | null;
  synthesisResult: SynthesisResult | null;
  processingStatus: string | null;
  error: string | null;
}

export type ReadingAction =
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

export const initialState: ReadingState = {
  phase: "setup",
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
  if (last && last.kind === "transcript" && last.pending) {
    return [...events.slice(0, -1), { ...last, pending: false }];
  }
  return events;
}

export function readingReducer(
  state: ReadingState,
  action: ReadingAction,
): ReadingState {
  switch (action.type) {
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
      if (last && last.kind === "transcript" && last.pending) {
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
      if (last && last.kind === "transcript" && last.pending) {
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
      if (last && last.kind === "scroll") {
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
      return initialState;
  }
}

export const ReadingContext = createContext<{
  state: ReadingState;
  dispatch: Dispatch<ReadingAction>;
}>({ state: initialState, dispatch: () => {} });

export function useReadingState() {
  return useContext(ReadingContext);
}
