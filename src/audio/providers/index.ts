import type { TranscriptionProvider } from "../../apiKeys.js";
import { voxtralProvider } from "./voxtral.js";
import { deepgramProvider } from "./deepgram.js";
import type { TranscriptionProviderStrategy } from "./types.js";

export type {
  TranscriptionEvent,
  TranscriptionEventKind,
  TranscriptionProviderStrategy,
} from "./types.js";

const STRATEGIES: Record<TranscriptionProvider, TranscriptionProviderStrategy> =
  {
    voxtral: voxtralProvider,
    deepgram: deepgramProvider,
  };

export function getProviderStrategy(
  id: TranscriptionProvider,
): TranscriptionProviderStrategy {
  return STRATEGIES[id];
}
