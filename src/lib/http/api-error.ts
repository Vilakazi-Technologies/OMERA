import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
  }
}

export function apiErrorResponse(error: unknown): NextResponse {
  const known = error instanceof ApiError;
  return NextResponse.json(
    { error: known ? error.code : "SERVICE_UNAVAILABLE" },
    {
      status: known ? error.status : 503,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
