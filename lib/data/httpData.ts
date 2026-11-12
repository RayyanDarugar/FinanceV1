import type { AppData } from "./AppData";
import { RPC_METHODS } from "./rpc";

/** Browser-side AppData that calls POST /api/data. */
export function createHttpData(fetchImpl: typeof fetch = (...a) => fetch(...a)): AppData {
  async function call(method: string, args: unknown[]) {
    const res = await fetchImpl("/api/data", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method, args }),
    });
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login";
      throw new Error("Signed out");
    }
    const body = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
    if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
    return body.result;
  }
  const data = {} as Record<string, (...a: unknown[]) => Promise<unknown>>;
  for (const m of RPC_METHODS) data[m] = (...args: unknown[]) => call(m, args);
  return data as unknown as AppData;
}
