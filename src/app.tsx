import { useReducer } from "react";
import { AppContext, appReducer, initialState } from "./state.js";
import { SetupScreen } from "./components/SetupScreen.js";
import { ReadingScreen } from "./components/ReadingScreen.js";
import { ProcessingScreen } from "./components/ProcessingScreen.js";
import { ResultsScreen } from "./components/ResultsScreen.js";

export function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {state.phase === "setup" && <SetupScreen />}
      {state.phase === "reading" && <ReadingScreen />}
      {state.phase === "processing" && <ProcessingScreen />}
      {state.phase === "results" && <ResultsScreen />}
    </AppContext.Provider>
  );
}
