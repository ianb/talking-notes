export class JinaReaderError extends Error {
  constructor(
    public status: number,
    public statusText: string,
  ) {
    super("Jina Reader request failed");
    this.name = "JinaReaderError";
  }
}

export async function fetchMarkdownFromUrl(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const res = await fetch(jinaUrl, {
    headers: {
      Accept: "text/markdown",
    },
  });

  if (!res.ok) {
    throw new JinaReaderError(res.status, res.statusText);
  }

  return res.text();
}
