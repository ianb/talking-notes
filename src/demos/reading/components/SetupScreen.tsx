import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useReadingState } from "../state.js";
import { useApiKeys } from "../../../apiKeys.js";
import { parseDocument } from "../utils/documentParser.js";
import { fetchMarkdownFromUrl } from "../api/jinaReader.js";

export function SetupScreen() {
  const { dispatch } = useReadingState();
  const { openai, transcriptionKey } = useApiKeys();
  const [markdownInput, setMarkdownInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const keysReady = !!openai && transcriptionKey !== null;
  const canStart = keysReady && markdownInput.trim().length > 0;

  async function handleFetchUrl() {
    if (!urlInput.trim()) return;
    setFetching(true);
    setFetchError(null);
    try {
      const md = await fetchMarkdownFromUrl(urlInput.trim());
      setMarkdownInput(md);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : String(err));
    } finally {
      setFetching(false);
    }
  }

  function handleStart() {
    if (!canStart) return;
    const sourceUrl = urlInput.trim() || undefined;
    const doc = parseDocument(markdownInput.trim(), sourceUrl);
    dispatch({ type: "SET_DOCUMENT", doc });
    dispatch({ type: "START_READING" });
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Reading Demo</h1>
          <Link
            to="/"
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            ← Home
          </Link>
        </div>
        <p className="text-gray-400">
          Read a document while speaking your thoughts aloud.
        </p>

        {!keysReady && (
          <div className="rounded-lg border border-amber-600/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            API keys aren't configured.{" "}
            <Link to="/" className="underline hover:text-amber-100">
              Set them up on the home page
            </Link>{" "}
            first.
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Import from URL
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/article"
              className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleFetchUrl}
              disabled={fetching || !urlInput.trim()}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-gray-200 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              {fetching ? "Fetching…" : "Fetch"}
            </button>
          </div>
          {fetchError ? <p className="text-sm text-red-400">{fetchError}</p> : null}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Or Paste Markdown
          </label>
          <textarea
            value={markdownInput}
            onChange={(e) => setMarkdownInput(e.target.value)}
            placeholder="Paste your article or document here..."
            rows={10}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono text-sm resize-y"
          />
        </div>

        <button
          onClick={handleStart}
          disabled={!canStart}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-lg transition-colors"
        >
          Start Reading
        </button>
      </div>
    </div>
  );
}
