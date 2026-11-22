import { describe, expect, it } from "vitest";
import {
  localAccountMemory,
  memoryFromStoredChats,
  renderAdvisorMemory,
} from "@/lib/ai/advisor-memory";

describe("advisor memory", () => {
  it("keeps business facts from earlier chats and skips the open thread and forms", () => {
    const account = memoryFromStoredChats(
      [
        {
          id: "open",
          title: "This chat",
          updatedAt: 3,
          messages: [
            { role: "user", content: "I sell vetkoek at taxi ranks.", createdAt: 1 },
          ],
        },
        {
          id: "older",
          title: "School catering",
          updatedAt: 2,
          messages: [
            { role: "user", content: "Hi", createdAt: 1 },
            {
              role: "user",
              content: "I run a school catering business in Soweto.",
              createdAt: 2,
            },
            {
              role: "assistant",
              content: "Start with one school you already know.",
              createdAt: 3,
            },
          ],
        },
      ],
      "open",
    );
    expect(account.facts).toEqual(["I run a school catering business in Soweto."]);
    expect(account.priorChats).toEqual([{
      title: "School catering",
      user: "I run a school catering business in Soweto.",
      assistant: "Start with one school you already know.",
    }]);

    const local = localAccountMemory(
      [
        {
          id: "open",
          title: "New chat",
          mode: "chat",
          messages: [],
        },
        {
          id: "older",
          title: "School catering",
          mode: "chat",
          messages: [{
            role: "user",
            content: "I run a school catering business in Soweto.",
            createdAt: 2,
          }],
        },
        {
          id: "form",
          title: "Form fill",
          mode: "form",
          messages: [{
            role: "user",
            content: "My ID number is 8001015800085.",
            createdAt: 1,
          }],
        },
      ],
      "open",
    );
    expect(local?.facts.join(" ")).toContain("school catering");
    expect(local?.facts.join(" ")).not.toContain("8001015800085");
  });

  it("renders name, language, and facts for the model", () => {
    const text = renderAdvisorMemory({
      name: "Ayanda Mkhize",
      languageName: "isiZulu",
      facts: ["I run a school catering business in Soweto."],
      priorChats: [],
    });
    expect(text).toContain("Name: Ayanda Mkhize");
    expect(text).toContain("isiZulu");
    expect(text).toContain("I run a school catering business in Soweto.");
    expect(renderAdvisorMemory({
      name: null,
      languageName: null,
      facts: [],
      priorChats: [],
    })).toBeNull();
  });
});
