/**
 * Hook that fires an OpenAI Q&A call for each completed `question … send`
 * bracket and reports the result through the supplied state setters.
 *
 * The earlier inline version returned an abort cleanup keyed on
 * `derived.qaCalls`, which is a new array on every transcript delta —
 * the cleanup ran several times a second, aborted every in-flight
 * fetch, and the call never completed. This hook stores controllers in
 * a ref and aborts only on unmount or via the returned `abortAll`
 * callback (which the app wires up to its Clear/Start handlers).
 *
 * State setters are stable across renders, so passing them straight in
 * keeps the deps array clean without callers having to wrap them in
 * `useCallback`.
 */

import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { QaCall } from "./deriveState.js";
import {
  answerQuestion,
  describeLlmAnswerError,
  type AnswerResult,
} from "./llmAnswer.js";

export interface AnswerEntry {
  status: "ok" | "error";
  data: AnswerResult | null;
  error: string | null;
}

interface UseAnswerDispatchArgs {
  qaCalls: QaCall[];
  answers: Map<string, AnswerEntry>;
  openai: string | null;
  setAnswers: Dispatch<SetStateAction<Map<string, AnswerEntry>>>;
}

export function useAnswerDispatch({
  qaCalls,
  answers,
  openai,
  setAnswers,
}: UseAnswerDispatchArgs): { abortAll: () => void } {
  const inflightRef = useRef<Map<string, AbortController>>(new Map());

  useEffect(() => {
    if (openai === null || openai.length === 0) return;
    const apiKey = openai;
    for (const call of qaCalls) {
      if (answers.has(call.id)) continue;
      if (inflightRef.current.has(call.id)) continue;
      const controller = new AbortController();
      inflightRef.current.set(call.id, controller);
      const target: QaCall = call;
      answerQuestion({
        apiKey,
        transcribed: target.transcribed,
        signal: controller.signal,
      })
        .then((result) => {
          inflightRef.current.delete(target.id);
          setAnswers((prev) => {
            if (prev.has(target.id)) return prev;
            const next = new Map(prev);
            next.set(target.id, {
              status: "ok",
              data: result,
              error: null,
            });
            return next;
          });
        })
        .catch((e: unknown) => {
          inflightRef.current.delete(target.id);
          if (e instanceof DOMException && e.name === "AbortError") return;
          const msg = describeLlmAnswerError(e);
          setAnswers((prev) => {
            if (prev.has(target.id)) return prev;
            const next = new Map(prev);
            next.set(target.id, { status: "error", data: null, error: msg });
            return next;
          });
        });
    }
  }, [qaCalls, answers, openai, setAnswers]);

  useEffect(
    () => () => {
      for (const c of inflightRef.current.values()) c.abort();
      inflightRef.current.clear();
    },
    [],
  );

  return {
    abortAll: () => {
      for (const c of inflightRef.current.values()) c.abort();
      inflightRef.current.clear();
    },
  };
}
