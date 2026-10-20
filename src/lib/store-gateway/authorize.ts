import { NextResponse } from "next/server";

export function authorizeStoreGateway(req: Request): NextResponse | null {
  const expected = process.env.VILATECH_STORE_SECRET?.trim();
  if (!expected) {
    return NextResponse.json({ error: "Gateway not configured" }, { status: 503 });
  }
  const header =
    req.headers.get("x-vilatech-store-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!header || header !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
