import { z } from "zod";
import { callJson, type LlmClient } from "@/lib/engine/llm";
import { fetchPageText } from "@/lib/engine/fetchPage";
import { buildQueries, tavilySearch } from "@/lib/engine/search";
import { estimateCostUsd, newUsage } from "@/lib/engine/usage";
import { makeProfile, NOW } from "../helpers/make";

const html = (body: string, status = 200, type = "text/html; charset=utf-8") =>
  new Response(body, { status, headers: { "content-type": type } });

describe("buildQueries", () => {
  test("at most 40 queries, speaking-related first, all unique", () => {
    const q = buildQueries(makeProfile(), NOW);
    expect(q.length).toBeGreaterThan(10);
    expect(q.length).toBeLessThanOrEqual(40);
    expect(new Set(q).size).toBe(q.length);
    for (const s of q.slice(0, 10)) expect(s.toLowerCase()).toMatch(/speak/);
  });

  test("mentions the next two months and area towns", () => {
    const q = buildQueries(makeProfile(), NOW).join(" ");
    expect(q).toMatch(/December/);
    expect(q).toMatch(/January/);
    expect(q).toMatch(/Carlsbad/);
  });
});

describe("tavilySearch", () => {
  test("maps results and counts the search", async () => {
    const usage = newUsage();
    const fetchImpl = vi.fn(async () =>
      Response.json({ results: [{ url: "https://a.org/e", title: "Gala", content: "Dec 12 gala", score: 0.9 }] }),
    );
    const out = await tavilySearch("charity gala Carlsbad", usage, { fetchImpl: fetchImpl as unknown as typeof fetch, apiKey: "k" });
    expect(out).toEqual([{ url: "https://a.org/e", title: "Gala", content: "Dec 12 gala" }]);
    expect(usage.searches).toBe(1);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ query: "charity gala Carlsbad", search_depth: "basic", max_results: 8 });
  });

  test("returns [] on API failure without throwing", async () => {
    const usage = newUsage();
    const out = await tavilySearch("x", usage, { fetchImpl: (async () => new Response("no", { status: 500 })) as unknown as typeof fetch, apiKey: "k" });
    expect(out).toEqual([]);
  });
});

describe("fetchPageText", () => {
  test("strips scripts, nav and footer; keeps main text", async () => {
    const usage = newUsage();
    const page = `<html><head><script>var x=1</script><style>.a{}</style></head><body>
      <nav>Home About</nav><main><h1>Holiday Gala</h1><p>Saturday, December 12, 2026 at 6pm</p></main>
      <footer>© 2026</footer><script>track()</script></body></html>`;
    const out = await fetchPageText("https://a.org/e", usage, { fetchImpl: (async () => html(page)) as unknown as typeof fetch });
    expect(out?.text).toContain("Holiday Gala");
    expect(out?.text).toContain("December 12, 2026");
    expect(out?.text).not.toContain("track()");
    expect(out?.text).not.toContain("Home About");
    expect(usage.fetches).toBe(1);
  });

  test("returns null on 404 and on non-HTML", async () => {
    const usage = newUsage();
    expect(await fetchPageText("https://a.org/x", usage, { fetchImpl: (async () => html("nope", 404)) as unknown as typeof fetch })).toBeNull();
    expect(await fetchPageText("https://a.org/x.pdf", usage, { fetchImpl: (async () => html("%PDF", 200, "application/pdf")) as unknown as typeof fetch })).toBeNull();
  });

  test("truncates very long pages to 20k characters", async () => {
    const usage = newUsage();
    const long = `<p>${"word ".repeat(10_000)}</p>`;
    const out = await fetchPageText("https://a.org/e", usage, { fetchImpl: (async () => html(long)) as unknown as typeof fetch });
    expect(out!.text.length).toBeLessThanOrEqual(20_000);
  });
});

describe("callJson", () => {
  const schema = z.object({ answer: z.string() });

  test("returns the parsed output and adds token usage and cost", async () => {
    const usage = newUsage();
    const client: LlmClient = {
      parse: vi.fn(async () => ({ parsed_output: { answer: "hi" }, stop_reason: "end_turn", usage: { input_tokens: 100, output_tokens: 20 } })),
    };
    expect(await callJson({ system: "s", user: "u", schema }, usage, client)).toEqual({ answer: "hi" });
    expect(usage.inputTokens).toBe(100);
    expect(usage.outputTokens).toBe(20);
    expect(usage.costUsd).toBeCloseTo((100 * 4 + 20 * 20) / 1e6, 10);
  });

  test("retries once, then returns null after two bad responses without throwing", async () => {
    const usage = newUsage();
    const parse = vi
      .fn()
      .mockResolvedValueOnce({ parsed_output: null, stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } })
      .mockRejectedValueOnce(new Error("overloaded"));
    expect(await callJson({ system: "s", user: "u", schema }, usage, { parse })).toBeNull();
    expect(parse).toHaveBeenCalledTimes(2);
  });

  test("a refusal counts as a failed attempt", async () => {
    const usage = newUsage();
    const parse = vi
      .fn()
      .mockResolvedValueOnce({ parsed_output: null, stop_reason: "refusal", usage: { input_tokens: 1, output_tokens: 0 } })
      .mockResolvedValueOnce({ parsed_output: { answer: "ok" }, stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } });
    expect(await callJson({ system: "s", user: "u", schema }, usage, { parse })).toEqual({ answer: "ok" });
  });
});

test("estimateCostUsd prices tokens at the configured model's rates", () => {
  const u = { ...newUsage(), inputTokens: 1_000_000, outputTokens: 100_000 };
  expect(estimateCostUsd(u, "claude-opus-5-5")).toBeCloseTo(4 + 2, 5);
  expect(estimateCostUsd(u, "claude-sonnet-5-5")).toBeCloseTo(2 + 1, 5);
});
