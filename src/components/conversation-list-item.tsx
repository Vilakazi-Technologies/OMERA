"use client";

import { FileText, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Conversation } from "@/lib/types";

type Props = {
  conversation: Conversation;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
};

export function ConversationListItem({
  conversation,
  active,
  onSelect,
  onDelete,
}: Props) {
  return (
    <div
      className={cn(
        "group mb-0.5 flex items-center gap-0.5 rounded-lg pr-1 transition",
        active ? "bg-white/10" : "hover:bg-white/5",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 truncate px-3 py-2 text-left text-sm",
          active ? "text-white" : "text-white/45 group-hover:text-white/80",
        )}
      >
        {conversation.mode === "form" ? (
          <FileText className="size-3.5 shrink-0" />
        ) : (
          <Sparkles className="size-3.5 shrink-0" />
        )}
        <span className="truncate">{conversation.title}</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className={cn(
          "rounded-md p-1.5 transition hover:bg-white/10 hover:text-red-300/90 focus-visible:outline-none",
          active
            ? "text-white/40 hover:text-red-300/90"
            : "text-white/20 group-hover:text-white/35",
        )}
        aria-label={`Delete ${conversation.title}`}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
