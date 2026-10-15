/**
 * Flat-form template registry (I4). A scanned/flat form matches only through
 * an approved template fingerprint. The registry starts EMPTY and stays
 * empty until gate G4 supplies owner-approved forms — an unrecognized scan
 * is rejected instead of inventing coordinates.
 */

import { createHash } from "node:crypto";

export type TemplateRotation = 0 | 90 | 180 | 270;

/** Rectangle in PDF points, with the page index and page rotation. */
export type TemplateRect = {
  fieldId: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: TemplateRotation;
};

export type FormTemplate = {
  fingerprint: string;
  name: string;
  rects: TemplateRect[];
};

const REGISTRY = new Map<string, FormTemplate>();

function validRect(rect: TemplateRect): boolean {
  if (!rect || typeof rect.fieldId !== "string" || !rect.fieldId) return false;
  for (const value of [rect.page, rect.x, rect.y, rect.width, rect.height]) {
    if (typeof value !== "number" || !Number.isFinite(value)) return false;
  }
  if (!Number.isInteger(rect.page) || rect.page < 0) return false;
  if (rect.width <= 0 || rect.height <= 0) return false;
  if (
    rect.rotation !== undefined &&
    rect.rotation !== 0 &&
    rect.rotation !== 90 &&
    rect.rotation !== 180 &&
    rect.rotation !== 270
  ) {
    return false;
  }
  return true;
}

/** Owner-supplied template registration (gate G4). No registry seed data. */
export function registerTemplate(template: FormTemplate): void {
  if (
    !template ||
    typeof template.fingerprint !== "string" ||
    !/^[0-9a-f]{64}$/.test(template.fingerprint) ||
    typeof template.name !== "string" ||
    !template.name.trim() ||
    !Array.isArray(template.rects) ||
    !template.rects.length ||
    !template.rects.every(validRect)
  ) {
    throw new Error("INVALID_TEMPLATE");
  }
  REGISTRY.set(template.fingerprint, template);
}

export function findTemplate(fingerprint: string): FormTemplate | null {
  return REGISTRY.get(fingerprint) ?? null;
}

export function clearRegistry(): void {
  REGISTRY.clear();
}

/** SHA-256 fingerprint of the raw document bytes. */
export function templateFingerprint(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
