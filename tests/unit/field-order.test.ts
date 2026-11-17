import { expect, it } from "vitest";
import { sortFieldsForQuestionFlow } from "@/lib/forms/field-order";
import type { StoredFormField } from "@/lib/db/form-sessions";

function field(
  id: string,
  label: string,
  extra: Partial<StoredFormField> = {},
): StoredFormField {
  return {
    id,
    label,
    type: "text",
    required: false,
    prompt: label,
    kind: "text",
    ...extra,
  };
}

it("orders identity, returnables, pricing, then signatures", () => {
  const ordered = sortFieldsForQuestionFlow([
    field("s", "Signature", { kind: "signature", required: true }),
    field("p", "Bid price", { required: true }),
    field("r", "SBD 4 bidders disclosure", { required: true }),
    field("n", "Name of bidder", { required: true }),
  ]);
  expect(ordered.map((row) => row.label)).toEqual([
    "Name of bidder",
    "SBD 4 bidders disclosure",
    "Bid price",
    "Signature",
  ]);
});
