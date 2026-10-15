// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const updateConversation = vi.fn();
const createConversation = vi.fn();

vi.mock("@/context/app-provider", () => ({
  useApp: () => ({
    activeId: "conv-1",
    createConversation,
    conversations: [
      {
        id: "conv-1",
        title: "New chat",
        mode: "chat",
        messages: [],
        updatedAt: Date.now(),
      },
    ],
    updateConversation,
    persistence: "local",
    languageId: "eng",
    setLanguageId: vi.fn(),
  }),
}));
vi.mock("@/lib/omera-sync", () => ({
  persistMessage: vi.fn(async () => undefined),
  persistConversationTitle: vi.fn(async () => undefined),
  persistCompletedAnswer: vi.fn(async () => true),
}));

import ChatPage from "@/app/(platform)/chat/page";

function sseBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function tokenStream(tokens: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const token of tokens) {
        controller.enqueue(
          sseBytes(`data: ${JSON.stringify({ token })}\n\n`),
        );
      }
      controller.enqueue(sseBytes("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

function errorStream(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(sseBytes('data: {"error":"CHAT_UNAVAILABLE"}\n\n'));
      controller.close();
    },
  });
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID !== "function"
  ) {
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      value: () => Math.random().toString(36).slice(2),
      configurable: true,
    });
  }
  vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: true }, 200)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function sendDraft(text: string) {
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
}

describe("chat page stream lifecycle", () => {
  it("the_busy_state_resets_after_a_stream_failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, body: errorStream() }) as Response),
    );
    render(<ChatPage />);
    await sendDraft("Help me price my service.");
    await waitFor(() => {
      expect(screen.getByRole("textbox")).not.toBeDisabled();
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("a_failed_draft_is_preserved_for_retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, body: errorStream() }) as Response),
    );
    render(<ChatPage />);
    await sendDraft("Help me obtain my first customer.");
    const retry = await screen.findByRole("button", { name: "Retry" });
    expect(screen.getByText("Help me obtain my first customer.")).toBeVisible();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => ({ ok: true, body: tokenStream(["All good"]) }) as Response,
      ),
    );
    fireEvent.click(retry);
    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      const calls = updateConversation.mock.calls as unknown[][];
      expect(JSON.stringify(calls)).toContain("All good");
    });
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("late_tokens_after_cancellation_are_ignored", async () => {
    let streamController: ReadableStreamDefaultController<Uint8Array> | null =
      null;
    const held = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
      },
    });
    let resolveFetch!: (value: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise((resolve) => {
        resolveFetch = resolve;
      })),
    );
    const { unmount } = render(<ChatPage />);
    await sendDraft("Help me improve cash flow.");
    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    });
    resolveFetch({ ok: true, body: held } as Response);
    await waitFor(() => {
      expect(streamController).not.toBeNull();
    });
    const callsAtUnmount = updateConversation.mock.calls.length;
    unmount();
    streamController!.enqueue(sseBytes('data: {"token":"late"}\n\n'));
    streamController!.enqueue(sseBytes("data: [DONE]\n\n"));
    streamController!.close();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const laterCalls = updateConversation.mock.calls.slice(callsAtUnmount);
    expect(JSON.stringify(laterCalls)).not.toContain("late");
  });
});
