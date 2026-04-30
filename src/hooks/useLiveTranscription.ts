/**
 * Streams microphone audio to Mistral Voxtral realtime via the dev-server
 * WebSocket proxy, and surfaces transcript delta / done events.
 *
 * Resources (MediaStream, AudioContext, Worklet, WebSocket) are created
 * when `enabled` becomes true and torn down when it becomes false.
 *
 * The hook itself is timing-agnostic: each delta callback receives just
 * the delta string. Consumers that care about wall-clock or relative time
 * should call `Date.now()` (or subtract their own start time) at the
 * call site — the transcription pipeline is not the right authority on
 * "when did the user start reading/recording/etc."
 */

import { useEffect, useRef, useState } from "react";
import pcmProcessorUrl from "../audio/pcm-processor.worklet.js?url";

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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary);
}

export function useLiveTranscription({
  apiKey,
  enabled,
  onDelta,
  onDone,
}: UseLiveTranscriptionOptions) {
  const [status, setStatus] = useState<LiveTranscriptionStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Keep callbacks in refs so the main effect doesn't tear down on every
  // render. Refs are updated inside an effect so they aren't written during
  // render.
  const onDeltaRef = useRef(onDelta);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDeltaRef.current = onDelta;
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (!enabled) return;

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

        const protocol =
          window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/transcribe-ws?key=${encodeURIComponent(apiKey)}`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (!disposed) setStatus("recording");
        };

        ws.onmessage = (event) => {
          if (disposed) return;
          let msg: { type?: string; delta?: string; text?: string; error?: unknown };
          try {
            msg = JSON.parse(event.data);
          } catch (_e) {
            return;
          }

          if (msg.type === "transcription.text.delta") {
            const delta = msg.delta ?? msg.text ?? "";
            if (delta) {
              onDeltaRef.current(delta);
            }
          } else if (msg.type === "transcription.done") {
            onDoneRef.current(msg.text);
          } else if (msg.type === "error") {
            let errMsg: string;
            if (typeof msg.error === "object" && msg.error !== null) {
              const objErr = msg.error as { message?: string };
              errMsg = objErr.message ?? JSON.stringify(msg.error);
            } else {
              errMsg = String(msg.error ?? "Transcription error");
            }
            errored = true;
            setError(errMsg);
            setStatus("error");
          }
        };

        ws.onerror = () => {
          if (!disposed) {
            errored = true;
            setError("WebSocket error");
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
            const base64Audio = arrayBufferToBase64(event.data.samples);
            ws.send(
              JSON.stringify({
                type: "input_audio.append",
                audio: base64Audio,
              }),
            );
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

  }, [enabled, apiKey]);

  return { status, error };
}
