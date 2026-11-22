import { describe, expect, it } from "vitest";
import { boundChatHistory, threadForModel } from "@/lib/ai/chat-history";
import type { ChatMessage } from "@/lib/types";

function message(id: string, content: string): ChatMessage {
  return { id, role: "user", content, createdAt: 1 };
}

describe("boundChatHistory", () => {
  it("a_short_history_passes_through_unchanged", () => {
    const history = [message("a", "one"), message("b", "two")];
    expect(boundChatHistory(history)).toBe(history);
  });

  it("an_overlong_history_keeps_only_the_tail", () => {
    const history = Array.from({ length: 60 }, (_, index) =>
      message(`m-${index}`, `message ${index}`),
    );
    const bounded = boundChatHistory(history);
    expect(bounded).toHaveLength(40);
    expect(bounded[0].id).toBe("m-20");
    expect(bounded[39].id).toBe("m-59");
  });

  it("an_overweight_history_drops_oldest_first", () => {
    const history = [
      message("old", "x".repeat(30000)),
      message("mid", "y".repeat(2000)),
      message("new", "latest"),
    ];
    const bounded = boundChatHistory(history);
    expect(bounded.map((entry) => entry.id)).toEqual(["mid", "new"]);
  });

  it("a_single_huge_message_is_truncated_not_dropped", () => {
    const bounded = boundChatHistory([message("only", "z".repeat(40000))]);
    expect(bounded).toHaveLength(1);
    expect(bounded[0].content).toHaveLength(32000);
  });
});

describe("threadForModel", () => {
  it("keeps the client thread when it already continues the stored one", () => {
    const stored = [
      { role: "user" as const, content: "I sell vetkoek." },
      { role: "assistant" as const, content: "Who buys them?" },
    ];
    const incoming = [...stored, { role: "user" as const, content: "Taxi ranks." }];
    expect(threadForModel(stored, incoming)).toEqual(incoming);
  });

  it("fills in stored history when the client sends only the latest turn", () => {
    const stored = [
      { role: "user" as const, content: "I sell vetkoek." },
      { role: "assistant" as const, content: "Who buys them?" },
    ];
    expect(threadForModel(stored, [{ role: "user", content: "Taxi ranks." }])).toEqual([
      ...stored,
      { role: "user", content: "Taxi ranks." },
    ]);
  });
});
