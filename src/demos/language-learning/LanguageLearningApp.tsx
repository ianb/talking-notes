/**
 * Language-learning demo. The user speaks in their target language and
 * brackets occasional English questions with `question` … `send`. Each
 * completed bracket is sent to OpenAI; the returned `{ question, answer }`
 * pair appears as a card in the Q&A log below the transcript.
 *
 * Derived state (`qaCalls`, `pendingQuestion`) is recomputed from the
 * raw transcript on every render — same shape of pure-derive pattern
 * used in spotter's edit mode. Async results land in the `answers` map
 * via `.then`/`.catch` (so we don't trip the setState-in-effect lint
 * rule), keyed by each call's stable id.
 *
 * `inflightRef` tracks which call ids currently have an LLM request in
 * flight, so a re-render before the request returns doesn't fire a
 * duplicate. Refs are touched only inside effects.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useApiKeys } from "../../apiKeys.js";
import { useLiveTranscription } from "../../hooks/useLiveTranscription.js";
import type {
  KeywordPattern,
  InputMatch,
} from "../spotter/utils/patmatch.js";
import { QUESTION_PATTERN, SEND_PATTERN } from "./keywords.js";
import { deriveState, type KeywordHit } from "./deriveState.js";
import { Transcript } from "./components/Transcript.js";
import { PendingChip, QaList } from "./components/QaList.js";
import { Header } from "./components/Header.js";
import {
  useAnswerDispatch,
  type AnswerEntry,
} from "./useAnswerDispatch.js";

function findHits(transcript: string, pattern: KeywordPattern): KeywordHit[] {
  if (transcript.trim().length === 0) return [];
  const matches: InputMatch[] = pattern.matchAll(transcript);
  const hits: KeywordHit[] = [];
  for (const m of matches) {
    const range = m.range;
    if (range.end > range.start) {
      hits.push({ start: range.start, end: range.end });
    }
  }
  return hits;
}

export function LanguageLearningApp() {
  const { mistral, openai } = useApiKeys();
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [answers, setAnswers] = useState<Map<string, AnswerEntry>>(
    () => new Map(),
  );

  const onDelta = useCallback((delta: string) => {
    setTranscript((current) => current + delta);
  }, []);
  const onDone = useCallback(() => {}, []);

  const apiKey = mistral === null ? "" : mistral;
  const { status, error } = useLiveTranscription({
    apiKey,
    enabled: recording && mistral !== null,
    onDelta,
    onDone,
  });

  const questionHits = useMemo(
    () => findHits(transcript, QUESTION_PATTERN),
    [transcript],
  );
  const sendHits = useMemo(
    () => findHits(transcript, SEND_PATTERN),
    [transcript],
  );

  const derived = useMemo(
    () => deriveState({ transcript, questionHits, sendHits }),
    [transcript, questionHits, sendHits],
  );

  const { abortAll } = useAnswerDispatch({
    qaCalls: derived.qaCalls,
    answers,
    openai,
    setAnswers,
  });

  const transcriptRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = transcriptRef.current;
    if (el === null) return;
    el.scrollTop = el.scrollHeight;
  }, [transcript]);

  const qaListRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = qaListRef.current;
    if (el === null) return;
    el.scrollTop = el.scrollHeight;
  }, [derived.qaCalls.length, answers]);

  function handleStart() {
    abortAll();
    setTranscript("");
    setAnswers(new Map());
    setRecording(true);
  }
  function handleStop() {
    setRecording(false);
  }
  function handleClear() {
    abortAll();
    setTranscript("");
    setAnswers(new Map());
  }

  if (mistral === null) return <NeedsKey />;

  const openaiMissing = openai === null || openai.length === 0;
  const noOpenaiBanner =
    openaiMissing &&
    (derived.qaCalls.length > 0 || derived.pendingQuestion !== null);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <Header
        recording={recording}
        status={status}
        statusError={error}
        onStart={handleStart}
        onStop={handleStop}
        onClear={handleClear}
      />

      <div className="pt-16 flex flex-col flex-1 min-h-0">
        <div
          ref={transcriptRef}
          className="h-[26vh] min-h-[180px] border-b border-gray-800 overflow-y-auto px-6 py-4 bg-gray-950"
        >
          <Transcript
            transcript={transcript}
            questionHits={questionHits}
            sendHits={sendHits}
            pendingStartIndex={
              derived.pendingQuestion === null
                ? null
                : derived.pendingQuestion.startIndex
            }
          />
        </div>

        <div ref={qaListRef} className="flex-1 overflow-y-auto px-6 py-6">
          <QaList
            qaCalls={derived.qaCalls}
            answers={answers}
            openaiMissing={openaiMissing}
          />
          {derived.pendingQuestion === null ? null : (
            <PendingChip pendingText={derived.pendingQuestion.transcribed} />
          )}
          {noOpenaiBanner ? (
            <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
              Add an OpenAI API key on the home screen to get answers.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function NeedsKey() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold">Language Learning</h1>
        <p className="text-gray-400">
          This demo needs a Mistral API key for live transcription, plus an
          OpenAI key to answer your questions.
        </p>
        <Link
          to="/"
          className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium"
        >
          Set API keys
        </Link>
      </div>
    </div>
  );
}
