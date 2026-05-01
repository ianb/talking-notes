import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useApiKeys,
  type TranscriptionProvider,
} from "../apiKeys.js";

export const Route = createFileRoute("/")({
  component: HomeScreen,
});

interface KeyFieldProps {
  label: string;
  hint: string;
  value: string;
  placeholder: string;
  onChange: (next: string) => void;
  onBlur: () => void;
}

function KeyField({
  label,
  hint,
  value,
  placeholder,
  onChange,
  onBlur,
}: KeyFieldProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-300">
        {label} <span className="text-gray-500">{hint}</span>
      </label>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}

interface ProviderTabProps {
  label: string;
  active: boolean;
  hasKey: boolean;
  onClick: () => void;
}

function ProviderTab({ label, active, hasKey, onClick }: ProviderTabProps) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
        active
          ? "bg-blue-600 border-blue-500 text-white"
          : "bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800"
      }`}
    >
      {label}
      {hasKey ? null : (
        <span
          className={`ml-2 text-xs ${
            active ? "text-amber-200" : "text-amber-400"
          }`}
        >
          (no key)
        </span>
      )}
    </button>
  );
}

function HomeScreen() {
  const {
    openai,
    mistral,
    deepgram,
    provider,
    setOpenai,
    setMistral,
    setDeepgram,
    setProvider,
  } = useApiKeys();
  const [openaiInput, setOpenaiInput] = useState(openai ?? "");
  const [mistralInput, setMistralInput] = useState(mistral ?? "");
  const [deepgramInput, setDeepgramInput] = useState(deepgram ?? "");

  function handleSaveOpenai() {
    if (openaiInput.trim() && openaiInput !== openai)
      setOpenai(openaiInput.trim());
  }
  function handleSaveMistral() {
    if (mistralInput.trim() && mistralInput !== mistral)
      setMistral(mistralInput.trim());
  }
  function handleSaveDeepgram() {
    if (deepgramInput.trim() && deepgramInput !== deepgram)
      setDeepgram(deepgramInput.trim());
  }
  function handleSelectProvider(p: TranscriptionProvider) {
    setProvider(p);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Talking Notes</h1>
          <p className="text-gray-400">
            Pick a transcription provider, jump into an experience, and
            paste your API keys at the bottom when you need them.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Transcription provider
          </h2>
          <div className="flex gap-2">
            <ProviderTab
              label="Voxtral"
              active={provider === "voxtral"}
              hasKey={mistral !== null && mistral.length > 0}
              onClick={() => handleSelectProvider("voxtral")}
            />
            <ProviderTab
              label="Deepgram"
              active={provider === "deepgram"}
              hasKey={deepgram !== null && deepgram.length > 0}
              onClick={() => handleSelectProvider("deepgram")}
            />
          </div>
          <p className="text-xs text-gray-500">
            Switch providers if one isn't working well. Each demo uses the
            currently-selected one. Voxtral handles mixed-language speech
            (e.g. language-learning mode) better than Deepgram.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Experiences
          </h2>
          <Link
            to="/reading"
            className="block rounded-lg border border-gray-700 hover:border-blue-500 bg-gray-900/40 px-5 py-4 transition-colors"
          >
            <div className="font-semibold text-gray-100">Reading Demo</div>
            <p className="text-sm text-gray-400 mt-1">
              Read a document while speaking your thoughts; an LLM stitches
              the result into an annotated journal.
            </p>
          </Link>
          <Link
            to="/spotter"
            className="block rounded-lg border border-gray-700 hover:border-blue-500 bg-gray-900/40 px-5 py-4 transition-colors"
          >
            <div className="font-semibold text-gray-100">Spotter</div>
            <p className="text-sm text-gray-400 mt-1">
              Live transcription with switchable keyword modes — notes,
              edit (LLM-driven message rewrites), and language learning
              (Spanish dictation with bracketed English questions and
              critiques).
            </p>
          </Link>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            API Keys
          </h2>
          <KeyField
            label="OpenAI API Key"
            hint="(synthesis)"
            value={openaiInput}
            placeholder="sk-..."
            onChange={setOpenaiInput}
            onBlur={handleSaveOpenai}
          />
          <KeyField
            label="Mistral API Key"
            hint="(Voxtral transcription)"
            value={mistralInput}
            placeholder="..."
            onChange={setMistralInput}
            onBlur={handleSaveMistral}
          />
          <KeyField
            label="Deepgram API Key"
            hint="(Deepgram transcription)"
            value={deepgramInput}
            placeholder="..."
            onChange={setDeepgramInput}
            onBlur={handleSaveDeepgram}
          />
        </section>
      </div>
    </div>
  );
}
