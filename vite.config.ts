import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { WebSocketServer, WebSocket } from "ws";

interface ProxyConfig {
  /** Path the browser connects to (e.g. "/transcribe-ws"). */
  pluginName: string;
  clientPath: string;
  /**
   * Build the upstream WebSocket URL from the request URL's query
   * params (e.g. translate model/sample_rate flags through to the
   * upstream).
   */
  buildUpstreamUrl: (clientUrl: URL) => string;
  /** How to authorize the upstream connection given the API key. */
  authHeader: (apiKey: string) => Record<string, string>;
  /** Human-readable name for log messages. */
  upstreamName: string;
}

/**
 * Generic dev-server WS proxy. The browser cannot set custom headers
 * on a WebSocket connection, so the API key arrives as a `?key=` query
 * param and this proxy injects it as the appropriate Authorization
 * header for the upstream provider.
 */
function wsProxy(config: ProxyConfig): PluginOption {
  return {
    name: config.pluginName,
    configureServer(server) {
      const wss = new WebSocketServer({ noServer: true });

      server.httpServer?.on("upgrade", (req, socket, head) => {
        if (!req.url?.startsWith(config.clientPath)) return;

        const url = new URL(req.url, "http://localhost");
        const apiKey = url.searchParams.get("key");
        if (!apiKey) {
          socket.destroy();
          return;
        }

        const upstreamUrl = config.buildUpstreamUrl(url);

        wss.handleUpgrade(req, socket, head, (client) => {
          const queued: (string | Buffer)[] = [];
          let upstreamReady = false;

          const upstream = new WebSocket(upstreamUrl, {
            headers: config.authHeader(apiKey),
          });

          // Surface the upstream HTTP response body when it rejects the
          // WS upgrade — by default `ws` only logs "Unexpected server
          // response: 4xx" without the body, which makes 4xx debugging
          // painful.
          upstream.on("unexpected-response", (_req, res) => {
            let body = "";
            res.on("data", (chunk: Buffer) => {
              body += chunk.toString();
            });
            res.on("end", () => {
              console.error(
                `[${config.pluginName}] ${config.upstreamName} HTTP ${res.statusCode}: ${body.slice(0, 500)}`,
              );
              if (client.readyState === WebSocket.OPEN) {
                client.send(
                  JSON.stringify({
                    type: "error",
                    error: `${config.upstreamName} HTTP ${res.statusCode}: ${body.slice(0, 200)}`,
                  }),
                );
                client.close(1011, `${config.upstreamName} HTTP ${res.statusCode}`);
              }
            });
          });

          upstream.on("open", () => {
            upstreamReady = true;
            for (const m of queued) upstream.send(m);
            queued.length = 0;
          });

          upstream.on("message", (data) => {
            if (client.readyState === WebSocket.OPEN) {
              // Pass through as-is — providers send either JSON text or
              // (for Deepgram keepalive ping replies) text frames; both
              // arrive here as Buffers and stringify cleanly.
              client.send(data.toString());
            }
          });

          upstream.on("error", (err) => {
            console.error(`[${config.pluginName}] ${config.upstreamName} error:`, err.message);
            if (client.readyState === WebSocket.OPEN) {
              client.send(
                JSON.stringify({
                  type: "error",
                  error: `${config.upstreamName} failed: ${err.message}`,
                }),
              );
              client.close(1011, `${config.upstreamName} error`);
            }
          });

          upstream.on("close", (code, reason) => {
            if (client.readyState === WebSocket.OPEN) {
              const reasonStr = reason.toString() || "(no reason)";
              client.send(
                JSON.stringify({
                  type: "error",
                  error: `${config.upstreamName} closed (code ${code}): ${reasonStr}`,
                }),
              );
              client.close(1000, "Upstream closed");
            }
          });

          client.on("message", (data, isBinary) => {
            // Forward client → upstream verbatim. Voxtral wants JSON
            // text frames; Deepgram wants raw binary audio; both arrive
            // here as RawData from the ws library.
            const payload = isBinary
              ? (data as Buffer)
              : data.toString();
            if (upstreamReady && upstream.readyState === WebSocket.OPEN) {
              upstream.send(payload);
            } else {
              queued.push(payload);
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

const voxtralProxy = (): PluginOption =>
  wsProxy({
    pluginName: "voxtral-proxy",
    clientPath: "/transcribe-ws",
    upstreamName: "Voxtral",
    buildUpstreamUrl: (url) => {
      const model =
        url.searchParams.get("model") ??
        "voxtral-mini-transcribe-realtime-2602";
      return `wss://api.mistral.ai/v1/audio/transcriptions/realtime?model=${encodeURIComponent(model)}`;
    },
    authHeader: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
  });

const deepgramProxy = (): PluginOption =>
  wsProxy({
    pluginName: "deepgram-proxy",
    clientPath: "/deepgram-ws",
    upstreamName: "Deepgram",
    buildUpstreamUrl: (url) => {
      // Forward every query param except `key` (which we consume here)
      // straight through to Deepgram. That keeps provider-specific
      // tuning (model, language, sample_rate, …) in the browser.
      const upstream = new URL("wss://api.deepgram.com/v1/listen");
      for (const [k, v] of url.searchParams.entries()) {
        if (k === "key") continue;
        upstream.searchParams.set(k, v);
      }
      return upstream.toString();
    },
    authHeader: (apiKey) => ({ Authorization: `Token ${apiKey}` }),
  });

export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    voxtralProxy(),
    deepgramProxy(),
  ],
  root: ".",
  // Expose OPENAI_* / MISTRAL_* / DEEPGRAM_* from .env to client code
  // (dev-only fallback is gated behind import.meta.env.DEV in apiKeys.tsx).
  envPrefix: ["VITE_", "OPENAI_", "MISTRAL_", "DEEPGRAM_"],
  build: {
    outDir: "dist",
  },
  server: {
    port: 3000,
  },
});
