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
    <article
      className={cn(
        "flex w-full flex-col gap-1.5",
        isUser ? "items-end" : "items-start",
      )}
    >
      <p className="text-xs font-medium tracking-wide text-white/35">
        {isUser ? "You" : "Omera"}
      </p>
      <div
        className={cn(
          "max-w-[min(100%,40rem)] text-[15px] leading-relaxed whitespace-pre-wrap",
          isUser ? "text-right text-white/70" : "text-white/90",
        )}
      >
        {renderMarkdownLite(message.content)}
      </div>
    </article>
  );
}
