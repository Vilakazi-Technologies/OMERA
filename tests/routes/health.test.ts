import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  isSupabaseConfigured: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));
import { isSupabaseConfigured, getSupabaseAdmin } from "@/lib/supabase/admin";
import { GET } from "@/app/api/health/route";

const ENV_KEYS = [
  "XAVANI_API_KEY",
  "XAVANI_BASE_URL",
  "XAVANI_MODEL",
  "LELAPA_API_KEY",
] as const;

function clearRuntimeEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

function healthyDb() {
  vi.mocked(isSupabaseConfigured).mockReturnValue(true);
  vi.mocked(getSupabaseAdmin).mockReturnValue({
    from: () => ({
      select: () => ({
        limit: async () => ({ error: null }),
      }),
    }),
  } as unknown as ReturnType<typeof getSupabaseAdmin>);
}

function failingDb() {
  vi.mocked(isSupabaseConfigured).mockReturnValue(true);
  vi.mocked(getSupabaseAdmin).mockReturnValue({
    from: () => ({
      select: () => ({
        limit: async () => ({ error: new Error("connection refused") }),
      }),
    }),
  } as unknown as ReturnType<typeof getSupabaseAdmin>);
}

beforeEach(() => {
  clearRuntimeEnv();
  vi.resetAllMocks();
});

it("an_empty_key_returns_unavailable", async () => {
  vi.mocked(isSupabaseConfigured).mockReturnValue(false);
  const response = await GET();
  const body = (await response.json()) as {
    status: string;
    chat: { state: string };
  };
  expect(body.chat.state).toBe("unavailable");
  expect(body.status).toBe("unavailable");
});

it("a_partial_key_returns_unavailable", async () => {
  process.env.XAVANI_API_KEY = "xavani-test-key";
  vi.mocked(isSupabaseConfigured).mockReturnValue(false);
  const response = await GET();
  const body = (await response.json()) as {
    status: string;
    chat: { state: string; configured: boolean };
  };
  expect(body.chat.configured).toBe(false);
  expect(body.chat.state).toBe("unavailable");
  expect(body.status).toBe("unavailable");
});

it("a_database_failure_does_not_report_healthy", async () => {
  process.env.XAVANI_API_KEY = "xavani-test-key";
  process.env.XAVANI_BASE_URL = "https://xavani.example/";
  failingDb();
  const response = await GET();
  const body = (await response.json()) as {
    status: string;
    database: { configured: boolean; reachable: boolean | null };
  };
  expect(body.database.configured).toBe(true);
  expect(body.database.reachable).toBe(false);
  expect(body.status).not.toBe("ok");
});

it("an_unverified_provider_reports_configured", async () => {
  process.env.XAVANI_API_KEY = "xavani-test-key";
  process.env.XAVANI_BASE_URL = "https://xavani.example/";
  healthyDb();
  const response = await GET();
  const body = (await response.json()) as {
    status: string;
    database: { configured: boolean; reachable: boolean | null };
    chat: {
      state: string;
      configured: boolean;
      compatibility: string;
      inference: string;
    };
  };
  expect(body.chat.configured).toBe(true);
  expect(body.chat.state).toBe("configured");
  expect(body.chat.compatibility).toBe("unverified");
  expect(body.chat.inference).toBe("unverified");
  expect(body.database.configured).toBe(true);
  expect(body.database.reachable).toBe(true);
  expect(body.status).toBe("ok");
});

it("an_unconfigured_database_returns_unavailable", async () => {
  process.env.XAVANI_API_KEY = "xavani-test-key";
  process.env.XAVANI_BASE_URL = "https://xavani.example/";
  vi.mocked(isSupabaseConfigured).mockReturnValue(false);
  const response = await GET();
  const body = (await response.json()) as {
    status: string;
    database: { configured: boolean; reachable: boolean | null };
  };
  expect(body.database.configured).toBe(false);
  expect(body.database.reachable).toBe(null);
  expect(vi.mocked(getSupabaseAdmin)).not.toHaveBeenCalled();
  expect(body.status).toBe("unavailable");
});

it("the_probe_reads_the_application_conversations_table", async () => {
  process.env.XAVANI_API_KEY = "xavani-test-key";
  process.env.XAVANI_BASE_URL = "https://xavani.example/";
  const probedTables: string[] = [];
  vi.mocked(isSupabaseConfigured).mockReturnValue(true);
  vi.mocked(getSupabaseAdmin).mockReturnValue({
    from: (table: string) => {
      probedTables.push(table);
      return {
        select: () => ({
          limit: async () => ({ error: null }),
        }),
      };
    },
  } as unknown as ReturnType<typeof getSupabaseAdmin>);
  const response = await GET();
  expect(response.status).toBe(200);
  expect(probedTables).toEqual(["omera_conversations"]);
});
