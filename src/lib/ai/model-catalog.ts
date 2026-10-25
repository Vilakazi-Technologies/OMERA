import "server-only";
import { getOpenRouterConfig, isOpenRouterConfigured } from "@/lib/ai/openrouter-client";
import { getXavaniConfig } from "@/lib/ai/xavani-client";
import type { ChatProvider } from "@/lib/ai/chat-runtime";

function resolveChatProvider(env: NodeJS.ProcessEnv = process.env): ChatProvider | null {
  try {
    getXavaniConfig(env);
    return "xavani";
  } catch {
    try {
      getOpenRouterConfig(env);
      return "openrouter";
    } catch {
      return null;
    }
  }
}

export type ModelCatalogEntry = {
  id: string;
  label: string;
  kind: "primary" | "extension";
  available: boolean;
  description?: string;
};

export const EXTENSION_MODELS: Omit<ModelCatalogEntry, "kind">[] = [
  {
    id: "openai/gpt-4o",
    label: "GPT-4o",
    available: false,
    description: "Extension preview",
  },
  {
    id: "openai/gpt-4.1",
    label: "GPT-4.1",
    available: false,
    description: "Extension preview",
  },
  {
    id: "anthropic/claude-sonnet-4",
    label: "Claude Sonnet",
    available: false,
    description: "Extension preview",
  },
  {
    id: "google/gemini-2.5-pro-preview",
    label: "Gemini 2.5 Pro",
    available: false,
    description: "Extension preview",
  },
];

export const OMERA_MODEL_ID = "omera";

/** User-facing name for VILATECH's AI (hosted on Xavani). */
export const OMERA_PRIMARY_LABEL = "Omera · Xavani";

export type ModelCatalog = {
  provider: "xavani" | "openrouter" | "unconfigured";
  models: ModelCatalogEntry[];
};

export function buildModelCatalog(env: NodeJS.ProcessEnv = process.env): ModelCatalog {
  const provider = resolveChatProvider(env);
  const models: ModelCatalogEntry[] = [];

  if (provider === "xavani") {
    const config = getXavaniConfig(env);
    models.push({
      id: OMERA_MODEL_ID,
      label: OMERA_PRIMARY_LABEL,
      kind: "primary",
      available: true,
      description: `Xavani · ${config.model}`,
    });
    for (const ext of EXTENSION_MODELS) {
      models.push({ ...ext, kind: "extension", available: false });
    }
    return { provider: "xavani", models };
  }

  if (provider === "openrouter" || isOpenRouterConfigured(env)) {
    models.push({
      id: OMERA_MODEL_ID,
      label: OMERA_PRIMARY_LABEL,
      kind: "primary",
      available: true,
      description: "VILATECH Xavani · Omera",
    });
    for (const ext of EXTENSION_MODELS) {
      models.push({ ...ext, kind: "extension", available: false });
    }
    return { provider: "openrouter", models };
  }

  models.push({
    id: OMERA_MODEL_ID,
    label: OMERA_PRIMARY_LABEL,
    kind: "primary",
    available: false,
    description: "Configure Xavani or OpenRouter",
  });
  for (const ext of EXTENSION_MODELS) {
    models.push({ ...ext, kind: "extension", available: false });
  }
  return { provider: "unconfigured", models };
}

/** Resolve OpenRouter model id for a UI selection. */
export function resolveChatModelForRequest(
  requested: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): { provider: "xavani" | "openrouter"; modelId: string } | null {
  const provider = resolveChatProvider(env);
  if (!provider) return null;

  const selection = requested?.trim() || OMERA_MODEL_ID;
  if (selection === OMERA_MODEL_ID) {
    return { provider, modelId: OMERA_MODEL_ID };
  }

  const ext = EXTENSION_MODELS.find((m) => m.id === selection);
  if (!ext?.available) {
    return { provider, modelId: OMERA_MODEL_ID };
  }

  if (provider === "openrouter") {
    return { provider: "openrouter", modelId: selection };
  }
  return { provider: "xavani", modelId: OMERA_MODEL_ID };
}

export function openRouterModelForSelection(
  selection: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (selection === OMERA_MODEL_ID) {
    return getOpenRouterConfig(env).model;
  }
  const ext = EXTENSION_MODELS.find((m) => m.id === selection);
  if (ext?.available) return ext.id;
  return getOpenRouterConfig(env).model;
}
