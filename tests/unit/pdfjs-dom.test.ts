import { expect, it } from "vitest";
import { ensurePdfJsDom } from "@/lib/forms/pdfjs-dom";

it("installs DOMMatrix so pdf.js can evaluate on Node", () => {
  const g = globalThis as typeof globalThis & { DOMMatrix?: unknown };
  const previous = g.DOMMatrix;
  try {
    // @ts-expect-error -- simulate Vercel Node without DOM canvas APIs
    delete g.DOMMatrix;
    ensurePdfJsDom();
    expect(typeof g.DOMMatrix).toBe("function");
    const Matrix = g.DOMMatrix as new (init?: number[]) => { a: number };
    expect(new Matrix().a).toBe(1);
    expect(new Matrix([2, 0, 0, 2, 0, 0]).a).toBe(2);
  } finally {
    g.DOMMatrix = previous;
  }
});
