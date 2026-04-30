import { useMemo, useReducer } from "react";
import { ReadingContext, readingReducer, initialState } from "./state.js";
import { SetupScreen } from "./components/SetupScreen.js";
import { ReadingScreen } from "./components/ReadingScreen.js";
import { ProcessingScreen } from "./components/ProcessingScreen.js";
import { ResultsScreen } from "./components/ResultsScreen.js";

export function ReadingApp() {
  const [state, dispatch] = useReducer(readingReducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);

  return (
    <ReadingContext.Provider value={value}>
      {state.phase === "setup" && <SetupScreen />}
      {state.phase === "reading" && <ReadingScreen />}
      {state.phase === "processing" && <ProcessingScreen />}
      {state.phase === "results" && <ResultsScreen />}
    </ReadingContext.Provider>
  );
}
