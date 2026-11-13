import * as cheerio from "cheerio";
import type { Usage } from "./usage";

const MAX_CHARS = 30_000; // links add text; calendars still fit

/** Fetches a page and returns its readable text (no scripts, nav, header or footer), links inline as "label (link: url)". Null on failure or non-HTML. */
export async function fetchPageText(
  url: string,
  usage: Usage,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<{ url: string; text: string } | null> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  usage.fetches++;
  try {
    const res = await fetchImpl(url, {
      headers: { "user-agent": "EventFinder/1.0", accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) return null;
    const $ = cheerio.load(await res.text());
    $("script, style, noscript, svg, iframe, nav, footer, header, form").remove();
    // Keep links inline so extraction can point each event at its own page instead of the calendar.
    const base = res.url || url;
    $("a[href]").each((_, a) => {
      const el = $(a);
      const label = el.text().replace(/\s+/g, " ").trim();
      let abs: string;
      try {
        abs = new URL(el.attr("href")!, base).toString();
      } catch {
        return;
      }
      if (!label || !/^https?:/.test(abs) || abs.split("#")[0] === base.split("#")[0]) return;
      el.text(`${label} (link: ${abs})`);
    });
    const title = $("title").first().text().trim();
    const body = $("body").text().replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").replace(/\n{2,}/g, "\n").trim();
    const text = (title ? `${title}\n` : "") + body;
    return { url: res.url || url, text: text.slice(0, MAX_CHARS) };
  } catch {
    return null;
  }
}
