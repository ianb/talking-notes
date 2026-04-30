/* eslint-disable error/no-throw-literal */
/**
 * Apply an edit instruction to a message draft via OpenAI's fast model.
 *
 * Errors are split into a small hierarchy of dedicated classes so the
 * UI can render a sensible message without us having to interpolate
 * dynamic strings into a single Error type. Each subclass has a fixed
 * canonical message; specifics (status code, payload, etc.) ride along
 * as fields on the instance.
 *
 * The lint disable on this file is for `error/no-throw-literal` — we
 * re-throw the caught DOMException for AbortError so the caller can
 * skip cleanly via `instanceof DOMException`. The variable is a real
 * exception instance, but the rule can't see through the `unknown` type
 * narrowing. Fully scoped to the propagation site below.
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

export class LlmEditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmEditError";
  }
}

export class LlmEditNetworkError extends LlmEditError {
  override cause: unknown;
  constructor(cause: unknown) {
    super("Network error talking to OpenAI");
    this.name = "LlmEditNetworkError";
    this.cause = cause;
  }
  get displayMessage(): string {
    const detail =
      this.cause instanceof Error ? this.cause.message : String(this.cause);
    return `${this.message}: ${detail}`;
  }
}

export class LlmEditHttpError extends LlmEditError {
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
    this.name = "LlmEditHttpError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
  get displayMessage(): string {
    return `${this.message}: ${this.status} ${this.statusText}: ${this.body.slice(0, 200)}`;
  }
}

export class LlmEditBadJsonError extends LlmEditError {
  override cause: unknown;
  constructor(cause: unknown) {
    super("OpenAI response was not JSON");
    this.name = "LlmEditBadJsonError";
    this.cause = cause;
  }
}

export class LlmEditApiError extends LlmEditError {
  detail: string;
  constructor(detail: string) {
    super("OpenAI returned an error");
    this.name = "LlmEditApiError";
    this.detail = detail;
  }
  get displayMessage(): string {
    return `${this.message}: ${this.detail}`;
  }
}

export class LlmEditNoContentError extends LlmEditError {
  constructor() {
    super("OpenAI returned no content");
    this.name = "LlmEditNoContentError";
  }
}

export function describeLlmEditError(err: unknown): string {
  if (err instanceof LlmEditNetworkError) return err.displayMessage;
  if (err instanceof LlmEditHttpError) return err.displayMessage;
  if (err instanceof LlmEditApiError) return err.displayMessage;
  if (err instanceof LlmEditError) return err.message;
  return String(err);
}

interface ApplyEditArgs {
  apiKey: string;
  draft: string;
  instructions: string;
  signal: AbortSignal;
}

const SYSTEM_PROMPT = [
  "You edit short messages on the user's behalf.",
  "The user gives you the current draft and an edit instruction.",
  "Apply the instruction and return only the new draft text.",
  "Do not add quotation marks, headers, prefixes, or commentary.",
  "If the draft is empty, return your best attempt at composing a new message that follows the instruction.",
  "Preserve the user's tone and intent unless the instruction asks otherwise.",
].join(" ");

function buildUserMessage(draft: string, instructions: string): string {
  return [
    "Current draft:",
    draft.length === 0 ? "(empty)" : draft,
    "",
    "Edit instruction:",
    instructions,
  ].join("\n");
}

interface OpenAiChoice {
  message: { content: string | null };
}

interface OpenAiResponse {
  choices: OpenAiChoice[];
  error?: { message: string };
}

export async function applyLlmEdit({
  apiKey,
  draft,
  instructions,
  signal,
}: ApplyEditArgs): Promise<string> {
  const body = {
    model: MODEL,
    temperature: 0.4,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserMessage(draft, instructions) },
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
    // Re-throw aborts so the caller can recognize them via instanceof.
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
