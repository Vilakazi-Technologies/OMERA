"use client";

import { cn } from "@/lib/cn";
import type { ChatMessage } from "@/lib/types";

function renderMarkdownLite(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const text = message.content.trim();
  if (!isUser && !text) return null;

  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser ? (
        <div className="flex max-w-[min(100%,44rem)] gap-2.5">
          <span
            className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/20 to-white/5 ring-1 ring-white/12"
            aria-hidden
          >
            <span className="font-serif text-xs font-medium text-amber-100/85">O</span>
          </span>
          <div
            className="liquid min-w-[12rem] flex-1 rounded-2xl border border-white/8 px-4 py-3.5 text-[15px] leading-relaxed text-white/90 whitespace-pre-wrap"
          >
            {renderMarkdownLite(message.content)}
          </div>
        </div>
      ) : (
        <div
          className="max-w-[min(100%,36rem)] rounded-2xl bg-white/12 px-4 py-3 text-sm leading-relaxed text-white whitespace-pre-wrap"
        >
          {renderMarkdownLite(message.content)}
        </div>
      )}
    </div>
  );
}
