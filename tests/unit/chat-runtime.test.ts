import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/xavani-client", () => ({
  getXavaniConfig: vi.fn(),
  createXavaniChatStream: vi.fn(),
  xavaniReachable: vi.fn(),
}));
vi.mock("@/lib/ai/openrouter-client", () => ({
  getOpenRouterConfig: vi.fn(),
  createOpenRouterChatStream: vi.fn(),
}));

import {
  createXavaniChatStream,
  getXavaniConfig,
  xavaniReachable,
} from "@/lib/ai/xavani-client";
import {
  createOpenRouterChatStream,
  getOpenRouterConfig,
} from "@/lib/ai/openrouter-client";
import {
  createConfiguredChatStream,
  researchHandledByXavani,
} from "@/lib/ai/chat-runtime";

const xavaniConfig = { baseUrl: "https://xavani.example", apiKey: "k", model: "omera" };
const openRouterConfig = { apiKey: "o", model: "m" };

function xavaniConfigured() {
  vi.mocked(getXavaniConfig).mockReturnValue(xavaniConfig);
  vi.mocked(createXavaniChatStream).mockReturnValue(new ReadableStream());
}

function openRouterConfigured() {
  vi.mocked(getOpenRouterConfig).mockReturnValue(openRouterConfig as never);
  vi.mocked(createOpenRouterChatStream).mockReturnValue(new ReadableStream());
}

function xavaniMissing() {
  vi.mocked(getXavaniConfig).mockImplementation(() => {
    throw new Error("XAVANI_UNAVAILABLE");
  });
}

afterEach(() => vi.clearAllMocks());

describe("provider selection", () => {
  it("uses Xavani when it answers", async () => {
    xavaniConfigured();
    openRouterConfigured();
    vi.mocked(xavaniReachable).mockResolvedValue(true);

    await createConfiguredChatStream([{ role: "user", content: "hi" }], null);

    expect(createXavaniChatStream).toHaveBeenCalled();
    expect(createOpenRouterChatStream).not.toHaveBeenCalled();
  });

  it("falls back to OpenRouter when Xavani is down", async () => {
    xavaniConfigured();
    openRouterConfigured();
    vi.mocked(xavaniReachable).mockResolvedValue(false);

    await createConfiguredChatStream([{ role: "user", content: "hi" }], null);

    expect(createOpenRouterChatStream).toHaveBeenCalled();
  });

  it("rejects when Xavani is down and no fallback exists", async () => {
    xavaniConfigured();
    vi.mocked(getOpenRouterConfig).mockImplementation(() => {
      throw new Error("OPENROUTER_UNAVAILABLE");
    });
    vi.mocked(xavaniReachable).mockResolvedValue(false);

    await expect(
      createConfiguredChatStream([{ role: "user", content: "hi" }], null),
    ).rejects.toThrow("CHAT_UNAVAILABLE");
  });

  it("uses OpenRouter when Xavani is not configured", async () => {
    xavaniMissing();
    openRouterConfigured();

    await createConfiguredChatStream([{ role: "user", content: "hi" }], null);

    expect(createOpenRouterChatStream).toHaveBeenCalled();
  });

  it("forwards the research flag to Xavani", async () => {
    xavaniConfigured();
    vi.mocked(xavaniReachable).mockResolvedValue(true);

    await createConfiguredChatStream(
      [{ role: "user", content: "hi" }], null, undefined, null, null, true,
    );

    expect(vi.mocked(createXavaniChatStream).mock.calls[0][5]).toBe(true);
  });
});

describe("research handoff", () => {
  it("hands research to Xavani only when it advertises support", () => {
    expect(researchHandledByXavani(true, "xavani", true)).toBe(true);
    expect(researchHandledByXavani(true, "xavani", false)).toBe(false);
    expect(researchHandledByXavani(false, "xavani", true)).toBe(false);
    expect(researchHandledByXavani(true, "openrouter", true)).toBe(false);
    expect(researchHandledByXavani(true, null, true)).toBe(false);
  });
});
