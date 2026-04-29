export async function fetchMarkdownFromUrl(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const res = await fetch(jinaUrl, {
    headers: {
      Accept: "text/markdown",
    },
  });

  if (!res.ok) {
    throw new Error(`Jina Reader error: ${res.status} — ${res.statusText}`);
  }

  return res.text();
}
