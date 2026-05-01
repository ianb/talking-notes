/* eslint-disable error/no-throw-literal */
/**
 * Send a transcribed question span to OpenAI and parse a structured
 * `{ question, answer }` response. We use json_object response format
 * so the model is forced to return valid JSON — the parsing layer
 * still validates field types defensively in case the model goes off-
 * script.
 *
 * Errors are split into typed subclasses so each unique condition has
 * a hardcoded message (lint rule). The eslint-disable on this file is
 * scoped to a single re-throw of `DOMException` (AbortError); narrowing
 * would otherwise lose the abort signal that the caller relies on.
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const TARGET_LANGUAGE = "Spanish";

export class LlmAnswerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmAnswerError";
  }
}

export class LlmAnswerNetworkError extends LlmAnswerError {
  override cause: unknown;
  constructor(cause: unknown) {
    super("Network error talking to OpenAI");
    this.name = "LlmAnswerNetworkError";
    this.cause = cause;
  }
  get displayMessage(): string {
    const detail =
      this.cause instanceof Error ? this.cause.message : String(this.cause);
    return `${this.message}: ${detail}`;
  }
}

export class LlmAnswerHttpError extends LlmAnswerError {
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
    this.name = "LlmAnswerHttpError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
  get displayMessage(): string {
    return `${this.message}: ${this.status} ${this.statusText}: ${this.body.slice(0, 200)}`;
  }
}

export class LlmAnswerBadJsonError extends LlmAnswerError {
  override cause: unknown;
  constructor(cause: unknown) {
    super("OpenAI response was not JSON");
    this.name = "LlmAnswerBadJsonError";
    this.cause = cause;
  }
}

export class LlmAnswerInvalidShapeError extends LlmAnswerError {
  raw: string;
  constructor(raw: string) {
    super("OpenAI response missing question/answer fields");
    this.name = "LlmAnswerInvalidShapeError";
    this.raw = raw;
  }
}

export class LlmAnswerNoContentError extends LlmAnswerError {
  constructor() {
    super("OpenAI returned no content");
    this.name = "LlmAnswerNoContentError";
  }
}

export function describeLlmAnswerError(err: unknown): string {
  if (err instanceof LlmAnswerNetworkError) return err.displayMessage;
  if (err instanceof LlmAnswerHttpError) return err.displayMessage;
  if (err instanceof LlmAnswerError) return err.message;
  return String(err);
}

export interface QuestionAnswer {
  question: string;
  answer: string;
}

export interface AnswerResult {
  qa: QuestionAnswer;
  /** The raw JSON content string returned by the LLM (before parsing). */
  raw: string;
}

export const SYSTEM_PROMPT_LINES = [
  `You are a language tutor helping an English speaker learn ${TARGET_LANGUAGE}.`,
  `The user is practicing ${TARGET_LANGUAGE} aloud but switches to English to`,
  "ask you a quick question. The text you receive is the spoken excerpt",
  "between the user's `question` marker and their `send` marker — it may",
  "include filler words, hesitations, or incidental words from the surrounding",
  `${TARGET_LANGUAGE} speech.`,
  "",
  "Your job:",
  "1. Extract the user's actual English question, cleaning up any filler.",
  "2. Answer it in ENGLISH — the listener is an English speaker. Quote the",
  `   ${TARGET_LANGUAGE} word or phrase when that's the point of the question`,
  '   (e.g. \'the word for "sleepy" is "somnoliento"\'), but the explanation',
  "   around it should be in English.",
  "",
  'Respond strictly with JSON: { "question": "...", "answer": "..." }.',
] as const;

const SYSTEM_PROMPT = SYSTEM_PROMPT_LINES.join("\n");

export { SYSTEM_PROMPT };

interface AnswerArgs {
  apiKey: string;
  transcribed: string;
  signal: AbortSignal;
}

interface OpenAiChoice {
  message: { content: string | null };
}

interface OpenAiResponse {
  choices: OpenAiChoice[];
  error?: { message: string };
}

function parseQa(content: string): QuestionAnswer {
  let obj: unknown;
  try {
    obj = JSON.parse(content);
  } catch (e) {
    throw new LlmAnswerBadJsonError(e);
  }
  if (typeof obj !== "object" || obj === null) {
    throw new LlmAnswerInvalidShapeError(content);
  }
  const record = obj as Record<string, unknown>;
  const question = record.question;
  const answer = record.answer;
  if (typeof question !== "string" || typeof answer !== "string") {
    throw new LlmAnswerInvalidShapeError(content);
  }
  return { question: question.trim(), answer: answer.trim() };
}

export async function answerQuestion({
  apiKey,
  transcribed,
  signal,
}: AnswerArgs): Promise<AnswerResult> {
  const body = {
    model: MODEL,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: transcribed },
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
    throw new LlmAnswerNetworkError(e);
  }

  if (!response.ok) {
    let bodyText = "";
    try {
      bodyText = await response.text();
    } catch (_e) {
      bodyText = "";
    }
    throw new LlmAnswerHttpError({
      status: response.status,
      statusText: response.statusText,
      body: bodyText,
    });
  }

  let parsed: OpenAiResponse;
  try {
    parsed = (await response.json()) as OpenAiResponse;
  } catch (e) {
    throw new LlmAnswerBadJsonError(e);
  }

  const first = parsed.choices[0];
  if (!first || first.message.content === null) {
    throw new LlmAnswerNoContentError();
  }
  const raw = first.message.content;
  const qa = parseQa(raw);
  return { qa, raw };
}
