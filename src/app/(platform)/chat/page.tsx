"use client";

import { useEffect, useRef, useState } from "react";
import { MessageBubble } from "@/components/message-bubble";
import { ChatComposer } from "@/components/chat-composer";
import { useApp } from "@/context/app-provider";
import { persistConversationTitle, persistMessage } from "@/lib/omera-sync";
import type { ChatMessage } from "@/lib/types";

const SUGGESTIONS = [
  "How does voice form filling work?",
  "Which South African languages do you support?",
  "We're at Metropolitan — can staff fill forms quietly?",
];

export default function ChatPage() {
  const {
    activeId,
    createConversation,
    conversations,
    updateConversation,
    persistence,
  } = useApp();
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversation =
    conversations.find((c) => c.id === activeId) ??
    conversations.find((c) => c.mode === "chat");

  useEffect(() => {
    if (!conversation && conversations.length === 0) {
      void createConversation("chat");
    }
  }, [conversation, conversations.length, createConversation]);

  const messages = conversation?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!conversation || streaming) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: Date.now(),
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

    setStreaming(true);
    const assistantId = crypto.randomUUID();
    let assistantText = "";

    updateConversation(conversation.id, {
      messages: [
        ...nextMessages,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          createdAt: Date.now(),
        },
      ],
    });

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: conversation.id,
        messages: nextMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") break;
          try {
            const { token } = JSON.parse(payload) as { token: string };
            assistantText += token;
            updateConversation(conversation.id, {
              messages: [
                ...nextMessages,
                {
                  id: assistantId,
                  role: "assistant",
                  content: assistantText,
                  createdAt: Date.now(),
                },
              ],
            });
          } catch {
            /* ignore partial json */
          }
        }
      }
    }

    if (persistence === "supabase" && assistantText.trim()) {
      void persistMessage(conversation.id, "assistant", assistantText);
    }

    setStreaming(false);
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
              What can I help you with today?
            </h2>
            <p className="mt-2 max-w-md text-sm text-slate-400">
              Ask anything — or open{" "}
              <span className="text-white">Form fill</span> to complete a
              document by voice.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => sendMessage(s)}
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

      <ChatComposer onSend={sendMessage} disabled={streaming} />
    </>
  );
}
