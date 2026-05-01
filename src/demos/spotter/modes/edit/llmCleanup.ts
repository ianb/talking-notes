/* eslint-disable error/no-throw-literal */
/**
 * Apply a "minimal cleanup" pass to a voice-transcribed message.
 *
 * The prompt is purpose-built for transcription artifacts (homophones,
 * punctuation that the engine inserted at pauses rather than where the
 * speaker meant it, occasional misheard rare words). It tells the
 * model to fix those specific issues but to leave the speaker's word
 * choices alone — the goal is "make this readable as the speaker
 * intended", not "make this better writing".
 *
 * Errors are intentionally shared with the regular edit path
 * (LlmEditError + subclasses) since they describe OpenAI HTTP/JSON
 * failures rather than anything edit-specific. The eslint-disable on
 * this file is for the AbortError re-throw — narrowing would lose the
 * abort signal the caller relies on.
 */

import {
  LlmEditApiError,
  LlmEditBadJsonError,
  LlmEditHttpError,
  LlmEditNetworkError,
  LlmEditNoContentError,
} from "./llmEdit.js";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT_LINES = [
  "You are correcting a voice-transcribed message. The text was produced",
  "by a live speech-to-text engine, so:",
  "",
  "- Punctuation is often arbitrary — the engine inserted it based on",
  "  pauses, not because the speaker dictated it. Adjust as needed for",
  "  readability.",
  "- Spelling may include homophone substitutions (e.g. their / there)",
  "  or misrecognized rare words. Use context to infer what the speaker",
  "  meant and substitute the right word.",
  "- Casing may be inconsistent.",
  "",
  "Your job is the MINIMUM cleanup needed for the message to read the way",
  "the speaker intended:",
  "",
  "- DO fix obvious transcription errors (homophones, misheard words,",
  "  broken punctuation, casing).",
  "- DO NOT smooth, rephrase, or restructure the speaker's words. Keep",
  "  their actual word choices and sentence structure intact.",
  "- DO NOT add words that aren't there or remove words that are.",
  '- DO NOT "improve" the writing.',
  "",
  "Return only the cleaned message text. No quotation marks, headers, or",
  "commentary.",
] as const;

const SYSTEM_PROMPT = SYSTEM_PROMPT_LINES.join("\n");

interface CleanupArgs {
  apiKey: string;
  draft: string;
  signal: AbortSignal;
}

interface OpenAiChoice {
  message: { content: string | null };
}

interface OpenAiResponse {
  choices: OpenAiChoice[];
  error?: { message: string };
}

export async function cleanupTranscript({
  apiKey,
  draft,
  signal,
}: CleanupArgs): Promise<string> {
  const body = {
    model: MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: draft },
    ],
  };

  let response: Response;
  try {
    response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new LlmEditNetworkError(e);
  }

  if (!response.ok) {
    let bodyText = "";
    try {
      bodyText = await response.text();
    } catch (_e) {
      bodyText = "";
    }
    throw new LlmEditHttpError({
      status: response.status,
      statusText: response.statusText,
      body: bodyText,
    });
  }

  let parsed: OpenAiResponse;
  try {
    parsed = (await response.json()) as OpenAiResponse;
  } catch (e) {
    throw new LlmEditBadJsonError(e);
  }

  if (parsed.error) {
    throw new LlmEditApiError(parsed.error.message);
  }

  const first = parsed.choices[0];
  if (!first || first.message.content === null) {
    throw new LlmEditNoContentError();
  }
  return first.message.content.trim();
}
