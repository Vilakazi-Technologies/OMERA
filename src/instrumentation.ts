export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/forms/pdfjs-dom");
  }
}
