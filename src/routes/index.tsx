import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useApiKeys } from "../apiKeys.js";

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

function HomeScreen() {
  const { openai, mistral, setOpenai, setMistral } = useApiKeys();
  const [openaiInput, setOpenaiInput] = useState(openai ?? "");
  const [mistralInput, setMistralInput] = useState(mistral ?? "");

  function handleSaveOpenai() {
    if (openaiInput.trim() && openaiInput !== openai)
      setOpenai(openaiInput.trim());
  }
  function handleSaveMistral() {
    if (mistralInput.trim() && mistralInput !== mistral)
      setMistral(mistralInput.trim());
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Talking Notes</h1>
          <p className="text-gray-400">
            Configure API keys, then choose an experience.
          </p>
        </header>

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
            hint="(live transcription)"
            value={mistralInput}
            placeholder="..."
            onChange={setMistralInput}
            onBlur={handleSaveMistral}
          />
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
        </section>
      </div>
    </div>
  );
}
