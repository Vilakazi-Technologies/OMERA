import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextResponse } from "next/server";
import { ApiError } from "@/lib/http/api-error";

export type SupabaseServerClient = ReturnType<typeof createServerClient>;

export type CookieUpdate = {
  name: string;
  value: string;
  options?: CookieOptions;
};

export type CookieMethods = {
  getAll: () => { name: string; value: string }[];
  setAll: (cookiesToSet: CookieUpdate[]) => void;
};

export type AuthContext = {
  supabase: SupabaseServerClient;
  cookies: CookieMethods;
  applyCookies(response: Response): Response;
};

function readServerEnv(): { url: string; anonKey: string } {
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ""
  ).trim();
  const anonKey = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ""
  ).trim();
  if (!url || !anonKey) throw new ApiError("SERVICE_UNAVAILABLE", 503);
  return { url, anonKey };
}

export async function createAuthContext(): Promise<AuthContext> {
  const { url, anonKey } = readServerEnv();
  const jar = await cookies();
  const pending: CookieUpdate[] = [];

  const cookieMethods: CookieMethods = {
    getAll: () => jar.getAll(),
    setAll: (cookiesToSet) => {
      pending.push(...cookiesToSet);
      try {
        for (const { name, value, options } of cookiesToSet) {
          jar.set(name, value, options);
        }
      } catch {
        // Cookie writes through next/headers only succeed in a route handler
        // or server action; pending updates still reach the response below.
      }
    },
  };

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieMethods.getAll(),
      setAll: (cookiesToSet) => cookieMethods.setAll(cookiesToSet),
    },
  });

  return {
    supabase,
    cookies: cookieMethods,
    applyCookies: (response: Response) => {
      const res = response as unknown as NextResponse;
      for (const { name, value, options } of pending) {
        res.cookies.set(name, value, options);
      }
      return response;
    },
  };
}
