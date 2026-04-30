import type {
  ParsedDocument,
  SessionEvent,
  SynthesisResult,
  ProcessedChunk,
  AnnotatedSegment,
  Statement,
} from "../types.js";
import { openaiRequest } from "./openai.js";

const SYSTEM_PROMPT = `You are analyzing a reading session. The user read a document while speaking their thoughts aloud, and occasionally selected a specific passage to flag it. You will receive:

1. The document text, divided into numbered segments
2. A chronological feed of session events:
   - [transcript] blocks of speech, with start/end timestamps and a unique id
   - [scroll] moments where the viewport changed, listing which segment ids were visible
   - [selection] passages the user explicitly pinned, tied to a specific segment

Voice transcripts may contain errors — use document context to interpret and correct technical terms and proper nouns.

For each transcript event, determine:
- classification: "invalid" (noise/not meaningful speech), "aside" (standalone thought not tied to a specific passage), or "annotation" (directly tied to a location in the document)
- cleanedTranscript: the corrected/cleaned transcript text
- relatedSegmentIds: which document segment IDs this relates to (based on scroll/selection events near the same time and on content)
- quotedText: if the user read text aloud or directly referenced a passage, include the exact quote from the document (omit if not applicable)

Use 'transcriptId' (the id of the transcript event) as the reference.

Also generate a "statements" array for a reading journal view. Each statement should have:
- text: a cleaned-up version of what the user said
- quotes: array of { text, segmentId } for relevant document quotes (include any user selections that support the statement)
- classification: "aside" or "annotation"

Only include non-invalid chunks in statements.

Return JSON with this exact structure:
{
  "processedChunks": [{ "transcriptId": "...", "classification": "...", "cleanedTranscript": "...", "relatedSegmentIds": [...], "quotedText": "..." }],
  "statements": [...]
}`;

function formatEvent(event: SessionEvent): string {
  if (event.kind === "transcript") {
    const s = Math.round(event.startTime / 1000);
    const e = Math.round(event.endTime / 1000);
    return `[transcript id=${event.id} ${s}s-${e}s] ${event.text}`;
  }
  if (event.kind === "scroll") {
    return `[scroll ${Math.round(event.time / 1000)}s] visible: ${event.visibleSegmentIds.join(", ")}`;
  }
  return `[selection ${Math.round(event.time / 1000)}s in ${event.segmentId}] "${event.text}"`;
}

function buildUserMessage(
  document: ParsedDocument,
  events: SessionEvent[],
): string {
  const segments = document.segments
    .map((s) => `[${s.id}] ${s.plainText}`)
    .join("\n\n");

  const feed = events.map(formatEvent).join("\n");

  return `## Document Segments\n\n${segments}\n\n## Session Feed\n\n${feed}`;
}

interface SynthesisResponse {
  processedChunks: ProcessedChunk[];
  statements: Statement[];
}

interface SynthesizeOptions {
  apiKey: string;
  document: ParsedDocument;
  events: SessionEvent[];
}

export async function synthesize({
  apiKey,
  document,
  events,
}: SynthesizeOptions): Promise<SynthesisResult> {
  const userMessage = buildUserMessage(document, events);

  const response = (await openaiRequest({
    apiKey,
    endpoint: "chat/completions",
    body: {
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    },
  })) as { choices: { message: { content: string } }[] };

  const firstChoice = response.choices[0];
  const content = firstChoice ? firstChoice.message.content : "{}";
  const parsed: SynthesisResponse = JSON.parse(content);

  const annotatedSegments: AnnotatedSegment[] = document.segments.map(
    (segment) => ({
      segment,
      annotations: parsed.processedChunks.filter(
        (c) =>
          c.classification !== "invalid" &&
          c.relatedSegmentIds.includes(segment.id),
      ),
    }),
  );

  return {
    processedChunks: parsed.processedChunks,
    annotatedSegments,
    statements: parsed.statements,
  };
}
