export type RuntimeMode = "live" | "demo" | "unavailable";

export function runtimeMode(
  key: string | undefined,
  environment: { NODE_ENV?: string; OMERA_DEMO_MODE?: string },
): RuntimeMode {
  if (key?.trim()) return "live";
  if (
    environment.NODE_ENV !== "production" &&
    environment.OMERA_DEMO_MODE === "true"
  ) {
    return "demo";
  }
  return "unavailable";
}
