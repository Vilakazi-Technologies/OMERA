/**
 * pdf.js 5 evaluates `new DOMMatrix()` at module load. Node on Vercel has no
 * DOM canvas APIs and no @napi-rs/canvas, so the analyze route 500s before
 * JSON error handling. Install stubs first; text extraction does not need a
 * real canvas.
 */
class NodeDOMMatrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;
  m11 = 1;
  m12 = 0;
  m13 = 0;
  m14 = 0;
  m21 = 0;
  m22 = 1;
  m23 = 0;
  m24 = 0;
  m31 = 0;
  m32 = 0;
  m33 = 1;
  m34 = 0;
  m41 = 0;
  m42 = 0;
  m43 = 0;
  m44 = 1;
  is2D = true;
  isIdentity = true;

  constructor(init?: ArrayLike<number> | string) {
    if (!init || typeof init === "string") return;
    const values = Array.from(init);
    if (values.length >= 6) {
      this.a = this.m11 = values[0] ?? 1;
      this.b = this.m12 = values[1] ?? 0;
      this.c = this.m21 = values[2] ?? 0;
      this.d = this.m22 = values[3] ?? 1;
      this.e = this.m41 = values[4] ?? 0;
      this.f = this.m42 = values[5] ?? 0;
    }
  }

  multiplySelf() {
    return this;
  }
  preMultiplySelf() {
    return this;
  }
  multiply() {
    return this;
  }
  invertSelf() {
    return this;
  }
  inverse() {
    return this;
  }
  translate() {
    return this;
  }
  translateSelf() {
    return this;
  }
  scale() {
    return this;
  }
  scaleSelf() {
    return this;
  }
}

class NodePath2D {
  addPath() {
    return;
  }
}

class NodeImageData {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  readonly colorSpace = "srgb";

  constructor(
    dataOrWidth: Uint8ClampedArray | number,
    widthOrHeight: number,
    maybeHeight?: number,
  ) {
    if (typeof dataOrWidth === "number") {
      this.width = dataOrWidth;
      this.height = widthOrHeight;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
      return;
    }
    this.data = dataOrWidth;
    this.width = widthOrHeight;
    this.height = maybeHeight ?? 0;
  }
}

export function ensurePdfJsDom(): void {
  const g = globalThis as typeof globalThis & {
    DOMMatrix?: unknown;
    Path2D?: unknown;
    ImageData?: unknown;
  };
  if (typeof g.DOMMatrix !== "function") g.DOMMatrix = NodeDOMMatrix;
  if (typeof g.Path2D !== "function") g.Path2D = NodePath2D;
  if (typeof g.ImageData !== "function") g.ImageData = NodeImageData;
}

ensurePdfJsDom();
