import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

const key = process.env.OPENROUTER_API_KEY?.trim();
if (!key) {
  console.error("OPENROUTER_API_KEY missing");
  process.exit(1);
}

const imgRes = await fetch(
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80"
);
const b64 =
  "data:image/jpeg;base64," + Buffer.from(await imgRes.arrayBuffer()).toString("base64");

const model = process.env.OPENROUTER_VISION_MODEL?.trim() || "google/gemini-2.5-flash";

const body = {
  model,
  stream: false,
  max_tokens: 800,
  messages: [
    {
      role: "system",
      content: 'Return ONLY JSON: {"ok":true,"note":"brief skin observation"}',
    },
    {
      role: "user",
      content: [
        { type: "text", text: "Describe skin briefly." },
        { type: "image_url", image_url: { url: b64, detail: "low" } },
      ],
    },
  ],
};

const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const text = await res.text();
console.log("status", res.status);
console.log(text.slice(0, 1200));
