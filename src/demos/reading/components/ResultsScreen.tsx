import { useState } from "react";
import { useReadingState } from "../state.js";
import { AnnotatedDocumentView } from "./AnnotatedDocumentView.js";
import { StatementsView } from "./StatementsView.js";

type ViewTab = "annotated" | "statements";

export function ResultsScreen() {
  const { state, dispatch } = useReadingState();
  const [activeTab, setActiveTab] = useState<ViewTab>("annotated");

  if (!state.synthesisResult) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="sticky top-0 z-50 bg-gray-900/95 border-b border-gray-700 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab("annotated")}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                activeTab === "annotated"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Annotated Document
            </button>
            <button
              onClick={() => setActiveTab("statements")}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                activeTab === "statements"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Statements &amp; Quotes
            </button>
          </div>
          <button
            onClick={() => dispatch({ type: "RESET" })}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            New Document
          </button>
        </div>
      </div>
      <div className="pt-4 pb-8">
        {activeTab === "annotated" ? (
          <AnnotatedDocumentView result={state.synthesisResult} />
        ) : (
          <StatementsView result={state.synthesisResult} />
        )}
      </div>
    </div>
  );
}
