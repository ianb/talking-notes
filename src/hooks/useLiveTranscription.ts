/**
 * Streams microphone audio to a live-transcription provider via the
 * dev-server WebSocket proxy and surfaces transcript delta / done /
 * error events.
 *
 * Provider-specific concerns (URL, audio framing, message parsing)
 * live in `src/audio/providers/`. The hook owns the parts that don't
 * vary: AudioContext + worklet lifecycle, the WS connection state
 * machine, and the resource cleanup contract on `enabled` toggling.
 *
 * The hook itself is timing-agnostic — each delta callback receives
 * just the delta string. Consumers that care about wall-clock or
 * relative time should call `Date.now()` (or subtract their own
 * start time) at the call site.
 */

import { useEffect, useRef, useState } from "react";
import pcmProcessorUrl from "../audio/pcm-processor.worklet.js?url";
import {
  getProviderStrategy,
  type TranscriptionProviderStrategy,
} from "../audio/providers/index.js";
import { useApiKeys } from "../apiKeys.js";

export type LiveTranscriptionStatus =
  | "idle"
  | "connecting"
  | "recording"
  | "error";

interface UseLiveTranscriptionOptions {
  apiKey: string;
  enabled: boolean;
  onDelta: (delta: string) => void;
  onDone: (text?: string) => void;
}

function buildWsUrl(
  strategy: TranscriptionProviderStrategy,
  apiKey: string,
): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const params = new URLSearchParams({ key: apiKey, ...strategy.proxyQuery() });
  return `${protocol}//${window.location.host}${strategy.proxyPath}?${params.toString()}`;
}

export function useLiveTranscription({
  apiKey,
  enabled,
  onDelta,
  onDone,
}: UseLiveTranscriptionOptions) {
  const { provider } = useApiKeys();
  const [status, setStatus] = useState<LiveTranscriptionStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Keep callbacks in refs so the main effect doesn't tear down on
  // every render. Refs are written from inside an effect so they aren't
  // mutated during render.
  const onDeltaRef = useRef(onDelta);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDeltaRef.current = onDelta;
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (!enabled) return;

    const strategy = getProviderStrategy(provider);
    let disposed = false;
    let errored = false;
    let ws: WebSocket | null = null;
    let audioContext: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let workletNode: AudioWorkletNode | null = null;

    function cleanup() {
      disposed = true;
      if (workletNode) {
        workletNode.disconnect();
        workletNode = null;
      }
      if (stream) {
        for (const track of stream.getTracks()) track.stop();
        stream = null;
      }
      if (audioContext) {
        audioContext.close().catch(() => {});
        audioContext = null;
      }
      if (ws) {
        if (
          (ws.readyState === WebSocket.OPEN ||
            ws.readyState === WebSocket.CONNECTING) &&
          strategy.beforeClose
        ) {
          strategy.beforeClose(ws);
        }
        if (
          ws.readyState === WebSocket.OPEN ||
          ws.readyState === WebSocket.CONNECTING
        ) {
          ws.close();
        }
        ws = null;
      }
    }

    (async () => {
      // setState calls run after the first await tick so they don't fire
      // synchronously inside the effect body. The "connecting" state
      // models WS lifecycle, which is an external system.
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (disposed) return cleanup();
        setStatus("connecting");
        setError(null);

        audioContext = new AudioContext();
        await audioContext.audioWorklet.addModule(pcmProcessorUrl);
        if (disposed) return cleanup();

        const source = audioContext.createMediaStreamSource(stream);
        workletNode = new AudioWorkletNode(audioContext, "pcm-processor");
        source.connect(workletNode);

        ws = new WebSocket(buildWsUrl(strategy, apiKey));
        // Important for Deepgram: send raw binary, not blobs.
        ws.binaryType = "arraybuffer";

        ws.onopen = () => {
          if (!disposed) setStatus("recording");
        };

        ws.onmessage = (event) => {
          if (disposed) return;
          const raw =
            typeof event.data === "string"
              ? event.data
              : (() => {
                  try {
                    return new TextDecoder().decode(event.data as ArrayBuffer);
                  } catch (_e) {
                    return "";
                  }
                })();
          const evt = strategy.parseMessage(raw);
          if (evt === null) return;
          if (evt.kind === "delta" && evt.text !== null) {
            onDeltaRef.current(evt.text);
          } else if (evt.kind === "done") {
            onDoneRef.current(evt.text === null ? undefined : evt.text);
          } else if (evt.kind === "error") {
            errored = true;
            setError(evt.message ?? "Transcription error");
            setStatus("error");
          }
        };

        ws.onerror = () => {
          if (!disposed) {
            errored = true;
            setError(`${strategy.displayName} WebSocket error`);
            setStatus("error");
          }
        };

        ws.onclose = () => {
          if (!disposed && !errored) {
            setStatus("idle");
          }
        };

        workletNode.port.onmessage = (event) => {
          if (
            event.data.type === "pcm" &&
            ws &&
            ws.readyState === WebSocket.OPEN
          ) {
            strategy.sendAudio(ws, event.data.samples as ArrayBuffer);
          }
        };
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : String(err));
          setStatus("error");
        }
        cleanup();
      }
    })();

    return cleanup;
  }, [enabled, apiKey, provider]);

  return { status, error };
}
