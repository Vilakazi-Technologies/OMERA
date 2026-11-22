import { afterEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { renderAdvisorMemory } from "@/lib/ai/advisor-memory";
import { buildOmeraSystemPrompt } from "@/lib/ai/omera-system-prompt";
import {
  clearXavaniCapabilityCache,
  createXavaniChatStream,
} from "@/lib/ai/xavani-client";

const config = { baseUrl: "https://xavani.example.test", apiKey: "test-key", model: "omera" };
const capabilities = {
  model: "omera",
  auth: { required: true },
  service: {
    name: "omera",
    contract: 1,
    stateless_requests: true,
    tools_enabled: false,
    memory_enabled: false,
    context_files_enabled: false,
    transcript_persistence: false,
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  clearXavaniCapabilityCache();
});

it("puts account memory and the human prompt in the model request", async () => {
  clearXavaniCapabilityCache();
  const memory = renderAdvisorMemory({
    name: "Ayanda Mkhize",
    languageName: "isiZulu",
    facts: ["I run a school catering business in Soweto."],
    priorChats: [{
      title: "First customer",
      user: "I need my first school contract.",
      assistant: "Start with one school you already know.",
    }],
  });
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(capabilities)))
    .mockResolvedValueOnce(new Response(
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Charge for the protein first." }, finish_reason: null }] })}\n\n` +
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\n\n` +
      "data: [DONE]\n\n",
      { headers: { "Content-Type": "text/event-stream" } },
    ));
  vi.stubGlobal("fetch", fetchMock);

  await new Response(createXavaniChatStream(
    config,
    [
      { role: "user", content: "I sell vetkoek at taxi ranks." },
      { role: "assistant", content: "Price the oil and the flour first." },
      { role: "user", content: "What should I charge?" },
    ],
    "zul",
    undefined,
    memory,
  )).text();

  const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
  const system = body.messages[0].content as string;
  expect(body.messages[0].role).toBe("system");
  expect(system).toContain(buildOmeraSystemPrompt("zul", memory));
  expect(system).toContain('Never open with "Certainly"');
  expect(system).toContain("I'd be happy to");
  expect(system).toContain("Name: Ayanda Mkhize");
  expect(system).toContain("I run a school catering business in Soweto.");
  expect(system).toContain("I need my first school contract.");
  expect(body.messages.slice(1)).toEqual([
    { role: "user", content: "I sell vetkoek at taxi ranks." },
    { role: "assistant", content: "Price the oil and the flour first." },
    { role: "user", content: "What should I charge?" },
  ]);
});
