import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type TranscriptionProvider = "voxtral" | "deepgram";

interface ApiKeys {
  openai: string | null;
  mistral: string | null;
  deepgram: string | null;
  provider: TranscriptionProvider;
}

interface ApiKeysContextValue extends ApiKeys {
  setOpenai: (key: string) => void;
  setMistral: (key: string) => void;
  setDeepgram: (key: string) => void;
  setProvider: (p: TranscriptionProvider) => void;
  /**
   * The currently-active transcription API key — `mistral` when the
   * provider is voxtral, `deepgram` when it's deepgram. Null when the
   * active provider has no key yet. Convenience for demos that just
   * want "the key the live transcription will use right now."
   */
  transcriptionKey: string | null;
}

const ApiKeysContext = createContext<ApiKeysContextValue>({
  openai: null,
  mistral: null,
  deepgram: null,
  provider: "voxtral",
  setOpenai: () => {},
  setMistral: () => {},
  setDeepgram: () => {},
  setProvider: () => {},
  transcriptionKey: null,
});

const PROVIDER_STORAGE_KEY = "transcription-provider";

const devEnv = (
  name: "OPENAI_API_KEY" | "MISTRAL_API_KEY" | "DEEPGRAM_API_KEY",
) => (import.meta.env.DEV ? (import.meta.env[name] ?? null) : null);

function loadProvider(): TranscriptionProvider {
  const stored = localStorage.getItem(PROVIDER_STORAGE_KEY);
  if (stored === "deepgram") return "deepgram";
  return "voxtral";
}

function loadInitial(): ApiKeys {
  return {
    openai: localStorage.getItem("openai-api-key") ?? devEnv("OPENAI_API_KEY"),
    mistral:
      localStorage.getItem("mistral-api-key") ?? devEnv("MISTRAL_API_KEY"),
    deepgram:
      localStorage.getItem("deepgram-api-key") ?? devEnv("DEEPGRAM_API_KEY"),
    provider: loadProvider(),
  };
}

export function ApiKeysProvider({ children }: { children: ReactNode }) {
  const [keys, setKeys] = useState<ApiKeys>(loadInitial);

  const value = useMemo<ApiKeysContextValue>(() => {
    const transcriptionKey =
      keys.provider === "voxtral" ? keys.mistral : keys.deepgram;
    return {
      ...keys,
      transcriptionKey,
      setOpenai: (key: string) => {
        localStorage.setItem("openai-api-key", key);
        setKeys((k) => ({ ...k, openai: key }));
      },
      setMistral: (key: string) => {
        localStorage.setItem("mistral-api-key", key);
        setKeys((k) => ({ ...k, mistral: key }));
      },
      setDeepgram: (key: string) => {
        localStorage.setItem("deepgram-api-key", key);
        setKeys((k) => ({ ...k, deepgram: key }));
      },
      setProvider: (p: TranscriptionProvider) => {
        localStorage.setItem(PROVIDER_STORAGE_KEY, p);
        setKeys((k) => ({ ...k, provider: p }));
      },
    };
  }, [keys]);

  return (
    <ApiKeysContext.Provider value={value}>{children}</ApiKeysContext.Provider>
  );
}

export function useApiKeys(): ApiKeysContextValue {
  return useContext(ApiKeysContext);
}
