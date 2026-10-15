"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageBubble } from "@/components/message-bubble";
import { ChatComposer } from "@/components/chat-composer";
import { useApp } from "@/context/app-provider";
import { consumeChatEvents } from "@/lib/ai/chat-events";
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
  const [streaming, setStreaming] = useState(false);
  const [failedDraft, setFailedDraft] = useState<string | null>(null);
  const [prevConversationId, setPrevConversationId] = useState<string | undefined>(undefined);
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
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    assistantIdRef.current = null;
  }, [conversationId]);

  if (prevConversationId !== conversationId) {
    setPrevConversationId(conversationId);
    setStreaming(false);
    setFailedDraft(null);
  }

  const messages = useMemo(
    () => conversation?.messages ?? [],
    [conversation],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    setFailedDraft(null);
    let assistantText = "";

    updateConversation(convId, {
      messages: [
        ...baseMessages,
        {
          id: assistantId,
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
          conversationId: convId,
          replyLanguageId,
          messages: baseMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error("CHAT_REQUEST_FAILED");
      await consumeChatEvents(res.body, (token) => {
        if (controller.signal.aborted) return;
        assistantText += token;
        updateConversation(convId, {
          messages: [
            ...baseMessages,
            {
              id: assistantId,
              role: "assistant",
              content: assistantText,
              createdAt: timestamp(),
            },
          ],
        });
      });
      if (controller.signal.aborted) return;
      if (assistantText.trim() && persistence === "supabase") {
        await persistCompletedAnswer(convId, assistantId, assistantText, true);
      }
    } catch {
      if (!controller.signal.aborted) {
        setFailedDraft(draftText);
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setStreaming(false);
      }
    }
  }

  async function sendMessage(text: string, replyLanguageId: string | null) {
    if (!conversation || streaming) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: timestamp(),
    };

    const nextMessages = [...messages, userMsg];
    const title =
      conversation.title === "New chat"
        ? text.slice(0, 42)
        : conversation.title;

    updateConversation(conversation.id, {
      messages: nextMessages,
      title,
    });

    if (persistence === "supabase") {
      void persistMessage(conversation.id, "user", text);
      if (conversation.title === "New chat") {
        void persistConversationTitle(conversation.id, title);
      }
    }

    await streamAssistant(
      conversation.id,
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
      <header className="border-b border-white/8 px-4 py-3 text-center sm:text-left">
        <h1 className="font-serif text-base font-medium text-white sm:text-lg">
          Omera
        </h1>
        <p className="text-xs text-white/45">
          A product of VILATECH · South Africa
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="mx-auto flex max-w-2xl flex-col items-center pt-[10vh] text-center">
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">
              What does your business need next?
            </h2>
            <p className="mt-2 max-w-md text-sm text-slate-400">
              Ask for practical business guidance, or use Form fill to complete
              a supported PDF.
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
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {failedDraft !== null && (
        <div className="mx-auto w-full max-w-3xl px-4 pb-2">
          <div className="liquid-card rounded-2xl p-3 text-sm">
            <p className="text-white/80">Message failed to send.</p>
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

      <ChatComposer onSend={sendMessage} disabled={streaming} />
    </>
  );
}
