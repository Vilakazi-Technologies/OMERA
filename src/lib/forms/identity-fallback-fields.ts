import type { StoredFormField } from "@/lib/db/form-sessions";

/** Generic questions when a tender/pack has text (or page images) but no labeled blanks. */
export function identityFallbackFields(): StoredFormField[] {
  return [
    {
      id: "field_1_bidder_name",
      label: "Company or bidder name",
      type: "text",
      required: true,
      prompt: "What is the company or bidder name to put on this document?",
      kind: "text",
    },
    {
      id: "field_2_contact_person",
      label: "Contact person",
      type: "text",
      required: true,
      prompt: "Who is the contact person for this submission?",
      kind: "text",
    },
    {
      id: "field_3_email",
      label: "Email",
      type: "text",
      required: true,
      prompt: "What email address should be on the form?",
      kind: "text",
    },
    {
      id: "field_4_phone",
      label: "Phone",
      type: "text",
      required: false,
      prompt: "What phone number should be on the form?",
      kind: "text",
    },
    {
      id: "field_5_what_to_complete",
      label: "What you need to complete",
      type: "text",
      required: false,
      prompt:
        "Tell us what you need to complete on this document (returnables, pricing, declarations). Omera will keep your notes on the answers page.",
      kind: "text",
    },
  ];
}
