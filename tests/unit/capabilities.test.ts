import { expect, it } from "vitest";
import { LANGUAGE_CAPABILITIES } from "@/lib/speech/capabilities";
import { GET } from "@/app/api/capabilities/route";

it("all_eleven_languages_have_a_text_route", () => {
  expect(LANGUAGE_CAPABILITIES.map((row) => row.id).sort()).toEqual([
    "afr",
    "eng",
    "nbl",
    "nso",
    "sot",
    "ssw",
    "tsn",
    "tso",
    "ven",
    "xho",
    "zul",
  ]);
  for (const row of LANGUAGE_CAPABILITIES) {
    expect(row.text).toBe(true);
  }
});

it("only_supported_languages_have_a_speech_route", () => {
  const speech = new Map(
    LANGUAGE_CAPABILITIES.map((row) => [row.id, row.speech] as const),
  );
  expect(speech.get("eng")).toBe("supported");
  expect(speech.get("zul")).toBe("supported");
  expect(speech.get("afr")).toBe("beta");
  expect(speech.get("sot")).toBe("beta");
  for (const id of ["xho", "nso", "tsn", "ssw", "ven", "tso", "nbl"]) {
    expect(speech.get(id)).toBe("unavailable");
  }
});

it("the_response_contains_no_vendor_names", async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    languages: { id: string; label: string; text: boolean; speech: string }[];
  };
  expect(body.languages).toHaveLength(11);
  for (const entry of body.languages) {
    expect(typeof entry.label).toBe("string");
    expect(entry.label.length).toBeGreaterThan(0);
  }
  expect(JSON.stringify(body)).not.toMatch(/lelapa|vulavula|whisper|openai/i);
});
