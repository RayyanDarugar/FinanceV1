import type { AppData } from "./AppData";

export const RPC_METHODS: ReadonlySet<keyof AppData> = new Set<keyof AppData>([
  "getProfile",
  "listEvents",
  "listGoing",
  "getEvent",
  "setMark",
  "recordOutcome",
  "listOrgs",
  "getOrg",
  "setOrgStatus",
  "markContacted",
  "proposeSettingsChange",
  "confirmSettingsChange",
]);

/** Runs one whitelisted AppData method. Used by POST /api/data. */
export async function dispatch(
  data: AppData,
  method: unknown,
  args: unknown,
): Promise<{ status: number; body: { result?: unknown; error?: string } }> {
  if (typeof method !== "string" || !RPC_METHODS.has(method as keyof AppData)) {
    return { status: 400, body: { error: "Unknown method" } };
  }
  if (!Array.isArray(args)) return { status: 400, body: { error: "args must be an array" } };
  try {
    const fn = data[method as keyof AppData] as (...a: unknown[]) => Promise<unknown>;
    const result = await fn.apply(data, args);
    return { status: 200, body: { result: result ?? null } };
  } catch (e) {
    console.error(`rpc ${method} failed`, e);
    return { status: 500, body: { error: "Something went wrong. Try again in a minute." } };
  }
}
