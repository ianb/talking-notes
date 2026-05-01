/**
 * Voxtral (Mistral) live transcription strategy. Sends PCM chunks
 * wrapped as `{type:"input_audio.append", audio: <base64>}` JSON
 * frames; reads `transcription.text.delta` / `transcription.done` /
 * `error` messages from the upstream stream.
 */

import type {
  TranscriptionEvent,
  TranscriptionProviderStrategy,
} from "./types.js";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCodePoint(byte);
  return btoa(binary);
}

interface VoxtralMessage {
  type?: string;
  delta?: string;
  text?: string;
  error?: unknown;
}

function describeError(err: unknown): string {
  if (typeof err === "object" && err !== null) {
    const obj = err as { message?: string };
    if (typeof obj.message === "string") return obj.message;
    return JSON.stringify(err);
  }
  return String(err ?? "Transcription error");
}

export const voxtralProvider: TranscriptionProviderStrategy = {
  id: "voxtral",
  displayName: "Voxtral",
  proxyPath: "/transcribe-ws",
  proxyQuery: () => ({}),
  sendAudio(ws, samples) {
    const base64 = arrayBufferToBase64(samples);
    ws.send(
      JSON.stringify({ type: "input_audio.append", audio: base64 }),
    );
  },
  parseMessage(data): TranscriptionEvent | null {
    let msg: VoxtralMessage;
    try {
      msg = JSON.parse(data) as VoxtralMessage;
    } catch (_e) {
      return null;
    }
    if (msg.type === "transcription.text.delta") {
      const delta = msg.delta ?? msg.text ?? "";
      if (delta.length === 0) return null;
      return { kind: "delta", text: delta, message: null };
    }
    if (msg.type === "transcription.done") {
      return { kind: "done", text: msg.text ?? null, message: null };
    }
    if (msg.type === "error") {
      return { kind: "error", text: null, message: describeError(msg.error) };
    }
    return null;
  },
};
