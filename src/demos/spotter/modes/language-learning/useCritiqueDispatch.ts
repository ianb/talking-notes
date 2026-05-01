/**
 * Hook that fires an OpenAI critique call for each `critique this`
 * marker the user produces. Same abort-controller-by-id pattern as
 * `useAnswerDispatch` so re-renders triggered by new transcript deltas
 * don't tear down in-flight fetches: controllers live in a ref and are
 * aborted only on unmount or via the returned `abortAll` callback.
 */

import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { CritiqueCall } from "./deriveState.js";
import {
  critiqueSpeech,
  describeLlmCritiqueError,
  type CritiqueResult,
} from "./llmCritique.js";

export interface CritiqueEntry {
  status: "ok" | "error";
  data: CritiqueResult | null;
  error: string | null;
}

interface UseCritiqueDispatchArgs {
  critiqueCalls: CritiqueCall[];
  critiques: Map<string, CritiqueEntry>;
  openai: string | null;
  setCritiques: Dispatch<SetStateAction<Map<string, CritiqueEntry>>>;
}

export function useCritiqueDispatch({
  critiqueCalls,
  critiques,
  openai,
  setCritiques,
}: UseCritiqueDispatchArgs): { abortAll: () => void } {
  const inflightRef = useRef<Map<string, AbortController>>(new Map());

  useEffect(() => {
    if (openai === null || openai.length === 0) return;
    const apiKey = openai;
    for (const call of critiqueCalls) {
      if (critiques.has(call.id)) continue;
      if (inflightRef.current.has(call.id)) continue;
      const controller = new AbortController();
      inflightRef.current.set(call.id, controller);
      const target: CritiqueCall = call;
      critiqueSpeech({
        apiKey,
        spanishContent: target.spanishContent,
        signal: controller.signal,
      })
        .then((result) => {
          inflightRef.current.delete(target.id);
          setCritiques((prev) => {
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
          const msg = describeLlmCritiqueError(e);
          setCritiques((prev) => {
            if (prev.has(target.id)) return prev;
            const next = new Map(prev);
            next.set(target.id, { status: "error", data: null, error: msg });
            return next;
          });
        });
    }
  }, [critiqueCalls, critiques, openai, setCritiques]);

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
