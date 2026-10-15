/**
 * Flat-form rectangle resolution (I4). Rectangles come only from an approved
 * template fingerprint — never inferred from a scan.
 */

import {
  findTemplate,
  templateFingerprint,
  type TemplateRect,
  type TemplateRotation,
} from "@/lib/forms/templates";

export type PlacedRectangle = {
  fieldId: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: TemplateRotation;
};

function placed(rect: TemplateRect): PlacedRectangle {
  return {
    fieldId: rect.fieldId,
    page: rect.page,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    rotation: rect.rotation ?? 0,
  };
}

/** Rectangles for an approved fingerprint. Unknown fingerprints are rejected. */
export function rectanglesForFingerprint(
  fingerprint: string,
): PlacedRectangle[] {
  const template = findTemplate(fingerprint);
  if (!template) throw new Error("UNKNOWN_TEMPLATE");
  return template.rects.map(placed);
}

/** Resolve rectangles for raw document bytes via their fingerprint. */
export function resolveRectangles(bytes: Uint8Array): PlacedRectangle[] {
  return rectanglesForFingerprint(templateFingerprint(bytes));
}
