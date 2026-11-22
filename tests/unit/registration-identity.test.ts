import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { answerQuestion } from "@/lib/forms/questions";
import {
  pairRegistrationIdentity,
  RECORDED_LEGAL_NAME,
  withRegistrationGuidance,
} from "@/lib/forms/registration-identity";
import { CAPABILITIES } from "@/components/landing/capabilities";

it("pairs a supplied registration number with the recorded legal name", () => {
  expect(RECORDED_LEGAL_NAME).toBe("Vilakazi Technologies");
  expect(pairRegistrationIdentity("2020/123456/07", RECORDED_LEGAL_NAME)).toBe(
    "2020/123456/07, Vilakazi Technologies",
  );
});

it("does not invent a registration number or a second company", () => {
  expect(pairRegistrationIdentity(null, RECORDED_LEGAL_NAME)).toBeNull();
  expect(pairRegistrationIdentity("Vilakazi Technologies", RECORDED_LEGAL_NAME)).toBeNull();
  expect(pairRegistrationIdentity("2020/123456/07", "")).toBeNull();
});

it("accepts a registration answer that already includes the name", () => {
  const flow = answerQuestion(
    {
      fields: [
        {
          id: "reg",
          label: "Company registration",
          prompt: "Company registration",
          required: true,
        },
      ],
      currentIndex: 0,
      languageId: "eng",
    },
    "2020/123456/07, Vilakazi Technologies",
  );
  expect(flow.fields[0]?.value).toBe("2020/123456/07, Vilakazi Technologies");
});

it("guides a registration question without putting the name on the marketing site", () => {
  const prompt = withRegistrationGuidance("Company registration", "Company registration");
  expect(prompt).toMatch(/registered name/i);
  expect(prompt).not.toMatch(/2020\/123456\/07/);
  const marketing = [
    ...CAPABILITIES.map((item) => `${item.title} ${item.description}`),
    readFileSync("src/components/landing/landing-page.tsx", "utf8"),
  ].join("\n");
  expect(marketing).not.toContain("Vilakazi Technologies");
  expect(marketing).not.toContain("2020/123456/07");
});
