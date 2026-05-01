/**
 * Provider abstraction for live transcription. Each provider declares
 * how to:
 *
 *  - build the dev-server WebSocket URL it talks to (the proxy injects
 *    the API key as a header on the way upstream),
 *  - send a PCM chunk over the open socket (Voxtral wraps base64 in
 *    JSON; Deepgram takes raw binary frames),
 *  - parse a string message from the upstream provider into the small
 *    `TranscriptionEvent` shape the hook consumes.
 *
 * `useLiveTranscription` is provider-agnostic — it owns the audio
 * pipeline and the WebSocket lifecycle, and dispatches everything
 * provider-specific through a strategy implementing this interface.
 */

export type TranscriptionEventKind = "delta" | "done" | "error";

export interface TranscriptionEvent {
  kind: TranscriptionEventKind;
  /** Filled for `delta` events — the new text to append to the transcript. */
  text: string | null;
  /** Filled for `error` events — a short, user-facing message. */
  message: string | null;
}

export interface TranscriptionProviderStrategy {
  id: "voxtral" | "deepgram";
  /** Human-readable name for status / error display. */
  displayName: string;
  /** Path on the dev server that proxies to this provider's upstream. */
  proxyPath: string;
  /**
   * Optional query params to set on the proxy URL — passed through to
   * the upstream WebSocket by the proxy. Used to plumb provider-
   * specific tuning (model, language, sample_rate, …) without baking
   * those into the proxy.
   */
  proxyQuery: () => Record<string, string>;
  /**
   * Send one PCM chunk (16-bit signed LE, 16 kHz, mono — the format
   * the shared worklet emits) over the already-open socket.
   */
  sendAudio: (ws: WebSocket, samples: ArrayBuffer) => void;
  /**
   * Parse one upstream message. Return null for messages that aren't
   * interesting to the consumer (provider keepalives, unknown types,
   * etc.).
   */
  parseMessage: (data: string) => TranscriptionEvent | null;
  /**
   * Optional hook for graceful shutdown — Deepgram wants a
   * `{type:"CloseStream"}` JSON frame so the server flushes any
   * pending finals before tearing the socket down.
   */
  beforeClose?: (ws: WebSocket) => void;
}
