export class OpenAIError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "OpenAIError";
  }
}

export async function openaiRequest(
  apiKey: string,
  endpoint: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(`https://api.openai.com/v1/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new OpenAIError(`OpenAI API error: ${res.status} — ${text}`, res.status);
  }

  return res.json();
}

export async function openaiFormData(
  apiKey: string,
  endpoint: string,
  formData: FormData,
): Promise<unknown> {
  const res = await fetch(`https://api.openai.com/v1/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new OpenAIError(`OpenAI API error: ${res.status} — ${text}`, res.status);
  }

  return res.json();
}
