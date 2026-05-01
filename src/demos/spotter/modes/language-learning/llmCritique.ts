/* eslint-disable error/no-throw-literal */
/**
 * Send a chunk of the user's Spanish speech to OpenAI for a short
 * language critique. Same `gpt-4o-mini` + JSON-mode shape as
 * `llmAnswer`, but the prompt is tuned for tutoring feedback and the
 * response is a single `critique` string.
 *
 * Errors share the LlmCritiqueError hierarchy so the UI can render a
 * sensible message without us having to interpolate dynamic strings
 * into a single Error type. The eslint-disable on this file is scoped
 * to a single re-throw of `DOMException` (AbortError) — narrowing
 * would otherwise lose the abort signal that the caller relies on.
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const TARGET_LANGUAGE = "Spanish";

export class LlmCritiqueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmCritiqueError";
  }
}

export class LlmCritiqueNetworkError extends LlmCritiqueError {
  override cause: unknown;
  constructor(cause: unknown) {
    super("Network error talking to OpenAI");
    this.name = "LlmCritiqueNetworkError";
    this.cause = cause;
  }
  get displayMessage(): string {
    const detail =
      this.cause instanceof Error ? this.cause.message : String(this.cause);
    return `${this.message}: ${detail}`;
  }
}

export class LlmCritiqueHttpError extends LlmCritiqueError {
  status: number;
  statusText: string;
  body: string;
  constructor({
    status,
    statusText,
    body,
  }: {
    status: number;
    statusText: string;
    body: string;
  }) {
    super("OpenAI HTTP error");
    this.name = "LlmCritiqueHttpError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
  get displayMessage(): string {
    return `${this.message}: ${this.status} ${this.statusText}: ${this.body.slice(0, 200)}`;
  }
}

export class LlmCritiqueBadJsonError extends LlmCritiqueError {
  override cause: unknown;
  constructor(cause: unknown) {
    super("OpenAI response was not JSON");
    this.name = "LlmCritiqueBadJsonError";
    this.cause = cause;
  }
}

export class LlmCritiqueInvalidShapeError extends LlmCritiqueError {
  raw: string;
  constructor(raw: string) {
    super("OpenAI response missing critique field");
    this.name = "LlmCritiqueInvalidShapeError";
    this.raw = raw;
  }
}

export class LlmCritiqueNoContentError extends LlmCritiqueError {
  constructor() {
    super("OpenAI returned no content");
    this.name = "LlmCritiqueNoContentError";
  }
}

export function describeLlmCritiqueError(err: unknown): string {
  if (err instanceof LlmCritiqueNetworkError) return err.displayMessage;
  if (err instanceof LlmCritiqueHttpError) return err.displayMessage;
  if (err instanceof LlmCritiqueError) return err.message;
  return String(err);
}

export interface CritiqueResult {
  critique: string;
  /** The raw JSON content the LLM returned (before parsing). */
  raw: string;
}

export const CRITIQUE_SYSTEM_PROMPT_LINES = [
  `You are a friendly ${TARGET_LANGUAGE} tutor for an English-speaking learner.`,
  `The user just spoke a short ${TARGET_LANGUAGE} excerpt. The text you receive`,
  "is the live transcription of that speech, with English question detours already",
  "removed. The transcription may include filler words, hesitations, or minor",
  "transcription errors — be charitable when you can't tell whether something is",
  "a transcription artifact or a learner mistake.",
  "",
  "Give the user one short, focused critique IN ENGLISH (the listener is an",
  "English speaker):",
  "- Note one or two specific things they did well, if anything stands out.",
  "- Point out the most useful one or two things to improve (grammar, word choice,",
  `  word order, or naturalness). Quote the ${TARGET_LANGUAGE} they said and the`,
  "  corrected version when relevant — but the explanation around the quotes",
  "  should be in English.",
  "- Keep it to roughly 2–4 sentences total. Friendly, concrete, no scoring.",
  "",
  'Respond strictly with JSON: { "critique": "..." }.',
] as const;

const CRITIQUE_SYSTEM_PROMPT = CRITIQUE_SYSTEM_PROMPT_LINES.join("\n");

interface CritiqueArgs {
  apiKey: string;
  spanishContent: string;
  signal: AbortSignal;
}

interface OpenAiChoice {
  message: { content: string | null };
}

interface OpenAiResponse {
  choices: OpenAiChoice[];
  error?: { message: string };
}

function parseCritique(content: string): { critique: string } {
  let obj: unknown;
  try {
    obj = JSON.parse(content);
  } catch (e) {
    throw new LlmCritiqueBadJsonError(e);
  }
  if (typeof obj !== "object" || obj === null) {
    throw new LlmCritiqueInvalidShapeError(content);
  }
  const record = obj as Record<string, unknown>;
  const critique = record.critique;
  if (typeof critique !== "string") {
    throw new LlmCritiqueInvalidShapeError(content);
  }
  return { critique: critique.trim() };
}

export async function critiqueSpeech({
  apiKey,
  spanishContent,
  signal,
}: CritiqueArgs): Promise<CritiqueResult> {
  const body = {
    model: MODEL,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: CRITIQUE_SYSTEM_PROMPT },
      { role: "user", content: spanishContent },
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
    throw new LlmCritiqueNetworkError(e);
  }

  if (!response.ok) {
    let bodyText = "";
    try {
      bodyText = await response.text();
    } catch (_e) {
      bodyText = "";
    }
    throw new LlmCritiqueHttpError({
      status: response.status,
      statusText: response.statusText,
      body: bodyText,
    });
  }

  let parsed: OpenAiResponse;
  try {
    parsed = (await response.json()) as OpenAiResponse;
  } catch (e) {
    throw new LlmCritiqueBadJsonError(e);
  }

  const first = parsed.choices[0];
  if (!first || first.message.content === null) {
    throw new LlmCritiqueNoContentError();
  }
  const raw = first.message.content;
  const { critique } = parseCritique(raw);
  return { critique, raw };
}
