/* eslint-disable error/no-throw-literal */
/**
 * Apply a "minimal cleanup" pass to a voice-transcribed message.
 *
 * The prompt is purpose-built for transcription artifacts (homophones,
 * punctuation that the engine inserted at pauses rather than where the
 * speaker meant it, occasional misheard rare words, filler words, and
 * abandoned starts that the speaker corrected mid-sentence). It tells
 * the model to fix those specific issues but to leave the speaker's
 * word choices alone — the goal is "make this readable as the speaker
 * intended", not "make this better writing".
 *
 * The system prompt also embeds the edit-mode keyword phrases so the
 * model can spot *missed* commands — a transcription engine sometimes
 * mishears a keyword (e.g. "clean text" for "clean up text") and the
 * pattern matcher lets it slip through as ordinary draft content.
 * Treating these near-misses as commands lets the model strip them
 * during cleanup.
 *
 * Errors are intentionally shared with the regular edit path
 * (LlmEditError + subclasses) since they describe OpenAI HTTP/JSON
 * failures rather than anything edit-specific. The eslint-disable on
 * this file is for the AbortError re-throw — narrowing would lose the
 * abort signal the caller relies on.
 */

import { EDIT_KEYWORDS } from "./keywords.js";
import {
  LlmEditApiError,
  LlmEditBadJsonError,
  LlmEditHttpError,
  LlmEditNetworkError,
  LlmEditNoContentError,
} from "./llmEdit.js";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

const KEYWORD_BLOCK = [
  "<keywords>",
  ...EDIT_KEYWORDS.map((k) => k.canonical),
  "</keywords>",
].join("\n");

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
  "- The speaker often emits filler words (umm, uh, like, you know) and",
  "  abandoned starts they corrected mid-sentence. Those are thinking-",
  "  out-loud noise, not part of the intended message.",
  "",
  "A separate keyword-spotting layer pulls voice commands out of the",
  "transcript when they match its patterns exactly. These phrases are",
  "the commands:",
  "",
  KEYWORD_BLOCK,
  "",
  "The speech-to-text engine sometimes mishears or paraphrases a",
  "command and the spotter doesn't catch it — so the failed attempt",
  "slips through into the draft as ordinary text. You can't be sure",
  "whether such words were meant as a command or as part of the",
  "message, so use this rule: if a stretch of text would not make",
  "sense as part of the message AND it plausibly resembles a failed",
  "attempt at one of the commands above, drop it. If it reads",
  "naturally as message content, leave it alone — even if it happens",
  "to look like a command. Examples of likely failed attempts:",
  "'clean text', 'send the message', 'starting edit'.",
  "",
  "Your job is the MINIMUM cleanup needed for the message to read the way",
  "the speaker intended:",
  "",
  "- DO fix obvious transcription errors (homophones, misheard words,",
  "  broken punctuation, casing).",
  "- DO remove filler words (umm, uh, 'like' used as filler, 'you know')",
  "  that don't add meaning.",
  "- DO remove abandoned starts and self-corrections. If the speaker",
  "  said 'I went to the — I went to the store' or 'today, I mean",
  "  yesterday, I went home', keep only the corrected version.",
  "- DO remove text that reads as a likely failed-attempt at one of the",
  "  keyword phrases above AND doesn't fit as message content. When in",
  "  doubt, leave it.",
  "- DO NOT smooth, rephrase, or restructure the speaker's actual word",
  "  choices. Use what they said as the building blocks; don't",
  "  improvise new words to make it flow better.",
  "- DO NOT add words that aren't there.",
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
