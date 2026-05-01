/**
 * Deepgram live transcription strategy. The shared PCM worklet emits
 * 16-bit signed-little-endian samples at 16 kHz, which is exactly what
 * Deepgram wants natively when we set `encoding=linear16` and
 * `sample_rate=16000`. We send each chunk as a raw binary WebSocket
 * frame.
 *
 * We turn `interim_results=true` on so the UI can show speech as it's
 * being recognized. Two distinct event kinds come back from
 * `parseMessage`:
 *
 *  - `delta` — fired when `is_final` is true. The text is committed
 *    and the consumer should append it to the persistent transcript.
 *  - `interim` — fired for every non-final result. The text is the
 *    current best guess of the live utterance and *replaces* whatever
 *    was previously interim (it is not a delta to append). The next
 *    `delta` event implicitly clears it.
 */

import type {
  TranscriptionEvent,
  TranscriptionProviderStrategy,
} from "./types.js";

const SAMPLE_RATE = 16000;

interface DeepgramMessage {
  type?: string;
  channel?: {
    alternatives?: { transcript?: string }[];
  };
  is_final?: boolean;
  speech_final?: boolean;
  message?: string;
  description?: string;
}

function extractTranscript(msg: DeepgramMessage): string {
  const channel = msg.channel;
  if (!channel) return "";
  const alts = channel.alternatives;
  if (!alts || alts.length === 0) return "";
  const first = alts[0];
  if (!first || typeof first.transcript !== "string") return "";
  return first.transcript;
}

export const deepgramProvider: TranscriptionProviderStrategy = {
  id: "deepgram",
  displayName: "Deepgram",
  proxyPath: "/deepgram-ws",
  proxyQuery: () => ({
    model: "nova-3",
    encoding: "linear16",
    sample_rate: String(SAMPLE_RATE),
    smart_format: "true",
    punctuate: "true",
    interim_results: "true",
    // Bump the silence threshold so single-thought utterances stay
    // together. `utterance_end_ms` is only honored when interim results
    // are on, which is why it lives here.
    utterance_end_ms: "1500",
  }),
  sendAudio(ws, samples) {
    ws.send(samples);
  },
  parseMessage(data): TranscriptionEvent | null {
    let msg: DeepgramMessage;
    try {
      msg = JSON.parse(data) as DeepgramMessage;
    } catch (_e) {
      return null;
    }
    // The proxy injects its own `{type: "error"}` envelopes for
    // upstream failures; honor those too.
    if (msg.type === "error") {
      const text = msg.message ?? msg.description ?? "Deepgram error";
      return { kind: "error", text: null, message: text };
    }
    if (msg.type === "Results") {
      const transcript = extractTranscript(msg).trim();
      if (transcript.length === 0) return null;
      if (msg.is_final === true) {
        // Add a trailing space so successive utterances don't run together.
        return { kind: "delta", text: `${transcript} `, message: null };
      }
      return { kind: "interim", text: transcript, message: null };
    }
    if (msg.type === "UtteranceEnd") {
      return { kind: "done", text: null, message: null };
    }
    return null;
  },
  beforeClose(ws) {
    // Tell Deepgram to flush any in-flight transcript before closing.
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "CloseStream" }));
      } catch (_e) {
        // Best-effort; the unconditional close below will tear it down anyway.
      }
    }
  },
};
