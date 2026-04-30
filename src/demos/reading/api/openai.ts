export class OpenAIError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super("OpenAI API request failed");
    this.name = "OpenAIError";
  }
}

interface OpenAIJsonRequest {
  apiKey: string;
  endpoint: string;
  body: Record<string, unknown>;
}

interface OpenAIFormDataRequest {
  apiKey: string;
  endpoint: string;
  formData: FormData;
}

export async function openaiRequest({
  apiKey,
  endpoint,
  body,
}: OpenAIJsonRequest): Promise<unknown> {
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
    throw new OpenAIError(res.status, text);
  }

  return res.json();
}

export async function openaiFormData({
  apiKey,
  endpoint,
  formData,
}: OpenAIFormDataRequest): Promise<unknown> {
  const res = await fetch(`https://api.openai.com/v1/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new OpenAIError(res.status, text);
  }

  return res.json();
}
