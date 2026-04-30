/** A paragraph-level chunk of the source document */
export interface DocumentSegment {
  id: string;
  index: number;
  markdown: string;
  plainText: string;
}

/** A parsed document ready for reading */
export interface ParsedDocument {
  title: string;
  sourceUrl?: string;
  rawMarkdown: string;
  segments: DocumentSegment[];
}

/**
 * A chronological event captured during a reading session.
 *
 * - `transcript`: a block of speech (built up from streaming deltas).
 *   `pending: true` means it's still being extended with incoming deltas;
 *   pending transcripts are finalized when the user stops talking or
 *   another event type arrives.
 * - `scroll`: the set of segments currently in the viewport changed.
 *   The reducer drops a preceding scroll if there's no intervening
 *   transcript text (the scroll was in-transit, not a real dwell).
 * - `selection`: the user selected text and hit "+" to pin it to the feed.
 */
export type SessionEvent =
  | {
      kind: "transcript";
      id: string;
      startTime: number;
      endTime: number;
      text: string;
      pending?: boolean;
    }
  | {
      kind: "scroll";
      id: string;
      time: number;
      visibleSegmentIds: string[];
    }
  | {
      kind: "selection";
      id: string;
      time: number;
      segmentId: string;
      text: string;
    };

/** LLM classification of a voice chunk */
export type ChunkClassification = "invalid" | "aside" | "annotation";

/** Processed voice chunk after LLM alignment */
export interface ProcessedChunk {
  transcriptId: string;
  classification: ChunkClassification;
  cleanedTranscript: string;
  relatedSegmentIds: string[];
  quotedText?: string;
}

/** A document segment with its annotations */
export interface AnnotatedSegment {
  segment: DocumentSegment;
  annotations: ProcessedChunk[];
}

/** A standalone statement with citations */
export interface Statement {
  text: string;
  quotes: { text: string; segmentId: string }[];
  classification: "aside" | "annotation";
}

/** Final synthesis result */
export interface SynthesisResult {
  processedChunks: ProcessedChunk[];
  annotatedSegments: AnnotatedSegment[];
  statements: Statement[];
}

/** App phase */
export type AppPhase = "setup" | "reading" | "processing" | "results";
