import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface ApiKeys {
  openai: string | null;
  mistral: string | null;
}

interface ApiKeysContextValue extends ApiKeys {
  setOpenai: (key: string) => void;
  setMistral: (key: string) => void;
}

const ApiKeysContext = createContext<ApiKeysContextValue>({
  openai: null,
  mistral: null,
  setOpenai: () => {},
  setMistral: () => {},
});

const devEnv = (name: "OPENAI_API_KEY" | "MISTRAL_API_KEY") =>
  import.meta.env.DEV ? (import.meta.env[name] ?? null) : null;

function loadInitial(): ApiKeys {
  return {
    openai: localStorage.getItem("openai-api-key") ?? devEnv("OPENAI_API_KEY"),
    mistral:
      localStorage.getItem("mistral-api-key") ?? devEnv("MISTRAL_API_KEY"),
  };
}

export function ApiKeysProvider({ children }: { children: ReactNode }) {
  const [keys, setKeys] = useState<ApiKeys>(loadInitial);

  const value = useMemo<ApiKeysContextValue>(
    () => ({
      ...keys,
      setOpenai: (key: string) => {
        localStorage.setItem("openai-api-key", key);
        setKeys((k) => ({ ...k, openai: key }));
      },
      setMistral: (key: string) => {
        localStorage.setItem("mistral-api-key", key);
        setKeys((k) => ({ ...k, mistral: key }));
      },
    }),
    [keys],
  );

  return (
    <ApiKeysContext.Provider value={value}>{children}</ApiKeysContext.Provider>
  );
}

export function useApiKeys(): ApiKeysContextValue {
  return useContext(ApiKeysContext);
}
