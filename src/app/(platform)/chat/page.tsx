"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageBubble } from "@/components/message-bubble";
import { ChatComposer } from "@/components/chat-composer";
import { OmeraThinking } from "@/components/omera-thinking";
import { OMERA_MODEL_ID } from "@/lib/ai/model-catalog-client";
import { useApp } from "@/context/app-provider";
import { consumeChatEvents } from "@/lib/ai/chat-events";
import { boundChatHistory } from "@/lib/ai/chat-history";
import {
  persistCompletedAnswer,
  persistConversationTitle,
  persistMessage,
} from "@/lib/omera-sync";
import type { ChatMessage } from "@/lib/types";

const SUGGESTIONS = [
  "Help me validate a business idea before I spend money.",
  "Help me obtain my first paying customer.",
  "Help me improve pricing and cash flow.",
];

function timestamp(): number {
  return Date.now();
}

const SAVE_FAILED_MESSAGE =
  "Couldn't save this chat. Your messages are visible but may not persist.";

const CHAT_SEND_ATTEMPTS = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chatFailureMessage(status: number, code?: string): string {
  if (code === "SERVICE_UNAVAILABLE" || status === 503) {
    return "Omera is busy or the AI service hiccuped. Tap Retry — we already try a few times automatically.";
  }
  if (code === "ORIGIN_FORBIDDEN" || status === 403) {
    return "This session could not reach the chat API. Try refreshing the page.";
  }
  if (code === "QUOTA_EXCEEDED" || status === 429) {
    return "You've hit the chat limit for now. Please try again in a minute.";
  }
  return "Omera couldn't finish that reply. Tap Retry — your question is still here.";
}

export default function ChatPage() {
  const {
    activeId,
    createConversation,
    conversations,
    updateConversation,
    persistence,
    languageId,
    languageExplicit,
  } = useApp();

  function persistChatModel(id: string) {
    setChatModelId(id);
    try {
      localStorage.setItem("omera-chat-model", id);
    } catch {
      // ignore
    }
  }
  const [chatModelId, setChatModelId] = useState(() => {
    if (typeof window === "undefined") return OMERA_MODEL_ID;
    return localStorage.getItem("omera-chat-model") ?? OMERA_MODEL_ID;
  });
  const [streaming, setStreaming] = useState(false);
  const [streamingConvId, setStreamingConvId] = useState<string | null>(null);
  const [failedDraft, setFailedDraft] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const pendingSavesRef = useRef<(() => Promise<unknown>)[]>([]);
  const lastStreamConvRef = useRef<string | null>(null);

  /** Track a persistence write so its failure stays visible and retryable. */
  function trackSave(save: () => Promise<unknown>) {
    pendingSavesRef.current.push(save);
    void save().then(
      () => {
        pendingSavesRef.current = pendingSavesRef.current.filter(
          (pending) => pending !== save,
        );
      },
      () => {
        setSaveError(SAVE_FAILED_MESSAGE);
      },
    );
  }

  async function retrySaves() {
    const saves = pendingSavesRef.current;
    pendingSavesRef.current = [];
    setSaveError(null);
    for (const save of saves) {
      try {
        await save();
      } catch {
        pendingSavesRef.current.push(save);
        setSaveError(SAVE_FAILED_MESSAGE);
        return;
      }
    }
  }
  const abortRef = useRef<AbortController | null>(null);
  const assistantIdRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversation =
    conversations.find((c) => c.id === activeId) ??
    conversations.find((c) => c.mode === "chat");

  const conversationId = conversation?.id;

  useEffect(() => {
    if (!conversation && conversations.length === 0) {
      void createConversation("chat");
    }
  }, [conversation, conversations.length, createConversation]);

  useEffect(() => {
    const previous = lastStreamConvRef.current;
    if (previous && conversationId && previous !== conversationId) {
      abortRef.current?.abort();
      setStreaming(false);
      setStreamingConvId(null);
    }
    lastStreamConvRef.current = conversationId ?? null;
  }, [conversationId]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const messages = useMemo(
    () =>
      (conversation?.messages ?? []).filter(
        (m) => m.role !== "assistant" || m.content.trim().length > 0,
      ),
    [conversation],
  );

  const awaitingReply =
    Boolean(conversation) &&
    !streaming &&
    messages.length > 0 &&
    messages[messages.length - 1]?.role === "user";

  const showThinking =
    Boolean(conversation) &&
    streaming &&
    streamingConvId === conversation?.id &&
    messages[messages.length - 1]?.role !== "assistant";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showThinking]);

  async function streamAssistant(
    convId: string,
    baseMessages: ChatMessage[],
    assistantId: string,
    draftText: string,
    replyLanguageId: string | null,
  ) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    assistantIdRef.current = assistantId;
    setStreaming(true);
    setStreamingConvId(convId);
    setFailedDraft(null);
    setSendError(null);

    let lastStatus = 0;
    let lastCode: string | undefined;

    try {
      for (let attempt = 0; attempt < CHAT_SEND_ATTEMPTS; attempt += 1) {
        if (controller.signal.aborted) return;

        const attemptAssistantId =
          attempt === 0 ? assistantId : crypto.randomUUID();
        assistantIdRef.current = attemptAssistantId;
        let assistantText = "";

        updateConversation(convId, {
          messages: [
            ...baseMessages,
            {
              id: attemptAssistantId,
              role: "assistant",
              content: "",
              createdAt: timestamp(),
            },
          ],
        });

        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversationId: persistence === "supabase" ? convId : undefined,
              modelId:
                attempt > 0 && chatModelId !== OMERA_MODEL_ID
                  ? OMERA_MODEL_ID
                  : chatModelId,
              replyLanguageId,
              messages: boundChatHistory(baseMessages).map((m) => ({
                role: m.role,
                content: m.content,
              })),
            }),
            signal: controller.signal,
          });
          lastStatus = res.status;
          if (!res.ok || !res.body) {
            try {
              const payload = (await res.json()) as { error?: string };
              lastCode = payload.error;
            } catch {
              lastCode = undefined;
            }
            throw new Error("CHAT_REQUEST_FAILED");
          }
          await consumeChatEvents(res.body, (token) => {
            if (controller.signal.aborted) return;
            assistantText += token;
            updateConversation(convId, {
              messages: [
                ...baseMessages,
                {
                  id: attemptAssistantId,
                  role: "assistant",
                  content: assistantText,
                  createdAt: timestamp(),
                },
              ],
            });
          });
          if (controller.signal.aborted) return;
          if (!assistantText.trim()) {
            throw new Error("EMPTY_CHAT_REPLY");
          }
          if (persistence === "supabase") {
            try {
              await persistCompletedAnswer(
                convId,
                attemptAssistantId,
                assistantText,
                true,
              );
            } catch {
              pendingSavesRef.current.push(() =>
                persistCompletedAnswer(
                  convId,
                  attemptAssistantId,
                  assistantText,
                  true,
                ),
              );
              if (!controller.signal.aborted) setSaveError(SAVE_FAILED_MESSAGE);
            }
          }
          return;
        } catch {
          if (controller.signal.aborted) return;
          updateConversation(convId, { messages: baseMessages });
          if (attempt < CHAT_SEND_ATTEMPTS - 1) {
            await sleep(280 * (attempt + 1));
            continue;
          }
          setSendError(chatFailureMessage(lastStatus, lastCode));
          setFailedDraft(draftText);
          return;
        }
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setStreaming(false);
        setStreamingConvId((current) => (current === convId ? null : current));
      }
    }
  }

  async function resumePendingReply() {
    if (!conversation || streaming || !awaitingReply) return;
    const lastUser = messages[messages.length - 1];
    if (!lastUser || lastUser.role !== "user") return;
    await streamAssistant(
      conversation.id,
      messages,
      crypto.randomUUID(),
      lastUser.content,
      languageExplicit ? languageId : null,
    );
  }

  async function sendMessage(text: string, replyLanguageId: string | null) {
    if (streaming) return;

    let convId = conversation?.id;
    let baseMessages = messages;
    let titleBase = conversation?.title ?? "New chat";

    if (!convId) {
      try {
        convId = await createConversation("chat");
        baseMessages = [];
        titleBase = "New chat";
      } catch {
        setSendError("Could not start a chat. Refresh the page and try again.");
        setFailedDraft(text);
        return;
      }
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: timestamp(),
    };

    const nextMessages = [...baseMessages, userMsg];
    const title =
      titleBase === "New chat" ? text.slice(0, 42) : titleBase;

    updateConversation(convId, {
      messages: nextMessages,
      title,
    });

    if (persistence === "supabase") {
      trackSave(() => persistMessage(convId, "user", text));
      if (titleBase === "New chat") {
        trackSave(() => persistConversationTitle(convId, title));
      }
    }

    await streamAssistant(
      convId,
      nextMessages,
      crypto.randomUUID(),
      text,
      replyLanguageId,
    );
  }

  async function retrySend() {
    if (!conversation || streaming) return;
    const draft = failedDraft;
    if (!draft) return;
    const failedId = assistantIdRef.current;
    const base = failedId
      ? messages.filter((m) => m.id !== failedId)
      : messages;
    await streamAssistant(
      conversation.id,
      base,
      crypto.randomUUID(),
      draft,
      languageExplicit ? languageId : null,
    );
  }

  return (
    <>
      <header className="border-b border-white/8 px-4 py-3">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="text-center sm:text-left">
            <h1 className="font-serif text-base font-medium text-white sm:text-lg">
              Omera
            </h1>
            <p className="text-xs text-white/45">
              A product of VILATECH · South Africa
            </p>
          </div>
          <p className="text-[11px] text-white/45 text-center sm:text-right">
            Ask about any business topic — not only the suggestions below.
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="mx-auto flex max-w-2xl flex-col items-center pt-[10vh] text-center">
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">
              What does your business need next?
            </h2>
            <p className="mt-2 max-w-md text-sm text-slate-400">
              Type any question in the box below. The chips are optional
              starters — Omera answers like a normal AI adviser.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    sendMessage(s, languageExplicit ? languageId : null)
                  }
                  className="liquid rounded-full px-4 py-2 text-xs text-white/70 transition hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {showThinking ? <OmeraThinking /> : null}
            {awaitingReply ? (
              <div className="flex justify-start pl-9">
                <button
                  type="button"
                  onClick={() => void resumePendingReply()}
                  className="rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-medium text-amber-100/90 transition hover:border-amber-400/50 hover:bg-amber-400/15"
                >
                  Get Omera&apos;s answer
                </button>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {failedDraft !== null && (
        <div className="mx-auto w-full max-w-3xl px-4 pb-2">
          <div className="liquid-card rounded-2xl p-3 text-sm">
            <p className="text-white/80">
              {sendError ?? "Message failed to send."}
            </p>
            <p className="mt-1 line-clamp-2 text-white/50">{failedDraft}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => void retrySend()}
                className="rounded-xl bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-white/90"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => setFailedDraft(null)}
                className="rounded-xl px-3 py-1.5 text-xs text-white/60 transition hover:text-white"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {saveError !== null && (
        <div
          role="alert"
          className="mx-auto w-full max-w-3xl px-4 pb-2"
        >
          <div className="liquid-card rounded-2xl p-3 text-sm">
            <p className="text-white/80">{saveError}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => void retrySaves()}
                className="rounded-xl bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-white/90"
              >
                Retry save
              </button>
              <button
                type="button"
                onClick={() => {
                  pendingSavesRef.current = [];
                  setSaveError(null);
                }}
                className="rounded-xl px-3 py-1.5 text-xs text-white/60 transition hover:text-white"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <ChatComposer
        onSend={sendMessage}
        disabled={streaming}
        chatModelId={chatModelId}
        onChatModelChange={persistChatModel}
      />
    </>
  );
}
