import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { WebSocketServer, WebSocket } from "ws";

/**
 * Dev-server plugin that proxies /transcribe-ws to Mistral's Voxtral
 * realtime endpoint. The browser cannot set custom headers on a
 * WebSocket connection, so the Mistral API key is passed as a query
 * param (?key=…) and this proxy injects it as the Authorization header.
 */
function voxtralProxy(): PluginOption {
  return {
    name: "voxtral-proxy",
    configureServer(server) {
      const wss = new WebSocketServer({ noServer: true });

      server.httpServer?.on("upgrade", (req, socket, head) => {
        if (!req.url?.startsWith("/transcribe-ws")) return;

        const url = new URL(req.url, "http://localhost");
        const apiKey = url.searchParams.get("key");
        const model =
          url.searchParams.get("model") ??
          "voxtral-mini-transcribe-realtime-2602";

        if (!apiKey) {
          socket.destroy();
          return;
        }

        wss.handleUpgrade(req, socket, head, (client) => {
          const mistralUrl = `wss://api.mistral.ai/v1/audio/transcriptions/realtime?model=${encodeURIComponent(model)}`;
          const queued: string[] = [];
          let mistralReady = false;

          const upstream = new WebSocket(mistralUrl, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });

          upstream.on("open", () => {
            mistralReady = true;
            for (const m of queued) upstream.send(m);
            queued.length = 0;
          });

          upstream.on("message", (data) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(data.toString());
            }
          });

          upstream.on("error", (err) => {
            console.error("[voxtral-proxy] Mistral error:", err.message);
            if (client.readyState === WebSocket.OPEN) {
              client.send(
                JSON.stringify({
                  type: "error",
                  error: `Transcription failed: ${err.message}`,
                }),
              );
              client.close(1011, "Mistral error");
            }
          });

          upstream.on("close", (code, reason) => {
            if (client.readyState === WebSocket.OPEN) {
              const reasonStr = reason.toString() || "(no reason)";
              client.send(
                JSON.stringify({
                  type: "error",
                  error: `Transcription closed (code ${code}): ${reasonStr}`,
                }),
              );
              client.close(1000, "Upstream closed");
            }
          });

          client.on("message", (data) => {
            const text = data.toString();
            if (mistralReady && upstream.readyState === WebSocket.OPEN) {
              upstream.send(text);
            } else {
              queued.push(text);
            }
          });

          client.on("close", () => {
            if (
              upstream.readyState === WebSocket.OPEN ||
              upstream.readyState === WebSocket.CONNECTING
            ) {
              upstream.close();
            }
          });

          client.on("error", () => {
            if (upstream.readyState === WebSocket.OPEN) upstream.close();
          });
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    voxtralProxy(),
  ],
  root: ".",
  // Expose OPENAI_* / MISTRAL_* from .env to client code (dev-only fallback
  // is gated behind import.meta.env.DEV in src/state.ts).
  envPrefix: ["VITE_", "OPENAI_", "MISTRAL_"],
  build: {
    outDir: "dist",
  },
  server: {
    port: 3000,
  },
});
