import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: [
      "tests/unit/**/*.test.ts",
      "tests/routes/**/*.test.ts",
      "tests/components/**/*.test.tsx",
    ],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: [
        "src/lib/ai/runtime-mode.ts",
        "src/lib/ai/omera-system-prompt.ts",
        "src/lib/ai/chat-request.ts",
        "src/lib/ai/chat-events.ts",
        "src/lib/ai/xavani-client.ts",
        "src/lib/speech/transcribe.ts",
        "src/lib/speech/wav.ts",
        "src/lib/forms/pdf-text.ts",
        "src/lib/forms/answers.ts",
        "src/lib/forms/pdf-fields.ts",
      ],
      thresholds: { perFile: true, statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});
