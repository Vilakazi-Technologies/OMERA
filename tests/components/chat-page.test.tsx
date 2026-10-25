// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const { updateConversation } = authFixtureFns;

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));
vi.mock("@/context/app-provider", () => ({
  useApp: vi.fn(),
}));
vi.mock("@/lib/omera-sync", () => ({
  persistMessage: vi.fn(async () => undefined),
  persistConversationTitle: vi.fn(async () => undefined),
  persistCompletedAnswer: vi.fn(async () => true),
}));
vi.mock("@/components/chat-model-select", () => ({
  ChatModelSelect: () => null,
}));

import ChatPage from "@/app/(platform)/chat/page";
import { useApp } from "@/context/app-provider";
import {
  persistCompletedAnswer,
  persistConversationTitle,
  persistMessage,
} from "@/lib/omera-sync";
import {
  authAppValue,
  authFixtureFns,
  resetAuthFixture,
} from "../fixtures/authenticated-app";

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

function fetchUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function chatFetchCalls() {
  return vi.mocked(fetch).mock.calls.filter((call) =>
    fetchUrl(call[0]).includes("/api/chat"),
  );
}

function installFetchRouter(
  chatHandler: () => Promise<Response>,
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = fetchUrl(input);
      if (url.includes("/api/chat")) {
        return chatHandler();
      }
      return jsonResponse({}, 404);
    }),
  );
}

beforeEach(() => {
  resetAuthFixture();
  vi.mocked(useApp).mockImplementation(() => authAppValue() as never);
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID !== "function"
  ) {
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      value: () => Math.random().toString(36).slice(2),
      configurable: true,
    });
  }
  installFetchRouter(async () => jsonResponse({ ok: true }, 200));
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
    installFetchRouter(
      async () => ({ ok: true, body: errorStream() }) as Response,
    );
    render(<ChatPage />);
    await sendDraft("Help me price my service.");
    await waitFor(
      () => {
        expect(screen.getByRole("textbox")).not.toBeDisabled();
        expect(chatFetchCalls()).toHaveLength(3);
      },
      { timeout: 5000 },
    );
  });

  it("a_failed_draft_is_preserved_for_retry", async () => {
    installFetchRouter(
      async () => ({ ok: true, body: errorStream() }) as Response,
    );
    render(<ChatPage />);
    await sendDraft("Help me obtain my first customer.");
    await waitFor(() => {
      expect(chatFetchCalls()).toHaveLength(3);
    }, { timeout: 5000 });
    const retry = await screen.findByRole("button", { name: "Retry" });
    expect(screen.getByText("Help me obtain my first customer.")).toBeVisible();

    installFetchRouter(
      async () => ({ ok: true, body: tokenStream(["All good"]) }) as Response,
    );
    fireEvent.click(retry);
    await waitFor(() => {
      expect(chatFetchCalls()).toHaveLength(1);
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
    let resolveFetch!: (value: Response) => void;
    installFetchRouter(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }) as Promise<Response>,
    );
    const { unmount } = render(<ChatPage />);
    await sendDraft("Help me improve cash flow.");
    await waitFor(() => {
      expect(chatFetchCalls()).toHaveLength(1);
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

  it("a_selected_language_is_sent_with_the_request", async () => {
    installFetchRouter(
      async () => ({ ok: true, body: tokenStream(["Sharp"]) }) as Response,
    );
    const { rerender } = render(<ChatPage />);
    await sendDraft("Help me price my service.");
    await waitFor(() => {
      expect(chatFetchCalls()).toHaveLength(1);
    });
    const defaultBody = JSON.parse(
      chatFetchCalls()[0][1]!.body as string,
    );
    expect(defaultBody.replyLanguageId).toBeNull();

    fireEvent.change(screen.getByLabelText(/speaking language/i), {
      target: { value: "zul" },
    });
    rerender(<ChatPage />);
    await sendDraft("Ngisize ngithole ikhasimende lami lokuqala.");
    await waitFor(() => {
      expect(chatFetchCalls()).toHaveLength(2);
    });
    const explicitBody = JSON.parse(
      chatFetchCalls()[1][1]!.body as string,
    );
    expect(explicitBody.replyLanguageId).toBe("zul");
  });

  it("a_failed_save_is_visible_and_retryable", async () => {
    resetAuthFixture({ persistence: "supabase" });
    let persistCalls = 0;
    const flakyPersist = async () => {
      persistCalls += 1;
      if (persistCalls <= 3) throw new Error("PERSIST_MESSAGE_FAILED:500");
      return undefined;
    };
    vi.mocked(persistMessage).mockImplementation(flakyPersist);
    vi.mocked(persistConversationTitle).mockImplementation(flakyPersist);
    vi.mocked(persistCompletedAnswer).mockImplementation(async () => {
      await flakyPersist();
      return true;
    });
    installFetchRouter(
      async () => ({ ok: true, body: tokenStream(["Saved?"]) }) as Response,
    );
    render(<ChatPage />);
    await sendDraft("Remember this.");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't save/i);
    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
    expect(persistCalls).toBeGreaterThan(3);
  });
});
