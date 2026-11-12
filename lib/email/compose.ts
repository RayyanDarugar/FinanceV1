import type { OrgWithNudges } from "@/lib/data/AppData";
import { complianceText } from "@/lib/domain/compliance";
import { formatCost, formatEventWhen } from "@/lib/domain/format";
import type { EventItem, Outcome, Profile } from "@/lib/types";

export interface WeeklyEmailInput {
  profile: Profile;
  ranked: EventItem[];
  orgsToReach: OrgWithNudges[];
  pending: EventItem[];
  links: { open: string; outcome: (eventId: string, n: Outcome) => string };
  now: Date;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const C = { ink: "#2b2b2b", muted: "#6f6a62", accent: "#2f5d34", amber: "#8a5a00", line: "#e6e1d8" };
const OUTCOMES: { n: Outcome; label: string }[] = [
  { n: 0, label: "0" },
  { n: 1, label: "1" },
  { n: 2, label: "2" },
  { n: 3, label: "3+" },
];

/** The Monday email. Inline styles only (email clients drop <style>). */
export function composeWeeklyEmail(input: WeeklyEmailInput): { subject: string; html: string; text: string } {
  const { profile, ranked, orgsToReach, pending, links, now } = input;
  const tz = profile.timezone;
  const n = ranked.length;
  const top = ranked.slice(0, 3);
  const subject = `Your ${n} picks this week`;

  const h: string[] = [];
  const t: string[] = [];
  const heading = (s: string) =>
    `<h2 style="font-size:17px;margin:22px 0 8px;color:${C.ink}">${esc(s)}</h2>`;

  h.push(`<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:${C.ink};max-width:560px;margin:0 auto;padding:8px 4px">`);
  h.push(`<p style="margin:0 0 4px">Good morning ${esc(profile.displayName)}, here are this week's best picks.</p>`);
  t.push(`Good morning ${profile.displayName}, here are this week's best picks.`, "");

  h.push(heading("Top 3"));
  t.push("TOP 3");
  top.forEach((e, i) => {
    const deadline = complianceText(e, profile, now);
    const speak = e.speaking === "asked" ? "🎤 " : e.speaking === "could_offer" ? "💡 " : "";
    const meta = `${formatEventWhen(e.startsAt, e.endsAt, tz)} · ${e.host} · ${formatCost(e.costUsd)}`;
    h.push(
      `<div style="margin:0 0 14px"><div style="font-weight:600">${i + 1}. ${speak}${esc(e.title)}</div>` +
        `<div style="color:${C.muted};font-size:14px">${esc(meta)}</div>` +
        `<div style="font-size:15px">${esc(e.whyGo)}</div>` +
        (deadline ? `<div style="color:${C.amber};font-size:14px">⏱ ${esc(deadline)}</div>` : "") +
        `</div>`,
    );
    t.push(`${i + 1}. ${speak}${e.title}`, `   ${meta}`, `   ${e.whyGo}`, ...(deadline ? [`   ${deadline}`] : []));
  });

  if (orgsToReach.length) {
    h.push(heading("Good time to reach out"));
    t.push("", "GOOD TIME TO REACH OUT");
    for (const o of orgsToReach) {
      const why = o.nudges.map((x) => x.text).join(" ");
      h.push(`<div style="margin:0 0 10px"><span style="font-weight:600">${esc(o.name)}</span><br><span style="font-size:15px;color:${C.muted}">${esc(why)}</span></div>`);
      t.push(`- ${o.name}: ${why}`);
    }
  }

  if (pending.length) {
    h.push(heading("How did it go?"));
    t.push("", "HOW DID IT GO?");
    for (const e of pending) {
      const btns = OUTCOMES.map(
        (o) =>
          `<a href="${esc(links.outcome(e.id, o.n))}" style="display:inline-block;min-width:36px;text-align:center;padding:8px 10px;margin:4px 6px 0 0;border:1px solid ${C.line};border-radius:8px;color:${C.accent};text-decoration:none;font-weight:600">${o.label}</a>`,
      ).join("");
      h.push(`<div style="margin:0 0 12px"><div>You went to <b>${esc(e.title)}</b>. Any good conversations?</div>${btns}</div>`);
      t.push(`You went to ${e.title}. Any good conversations? ` + OUTCOMES.map((o) => `${o.label}: ${links.outcome(e.id, o.n)}`).join("  "));
    }
  }

  h.push(
    `<p style="margin:26px 0 8px"><a href="${esc(links.open)}" style="display:block;text-align:center;background:${C.accent};color:#fff;border-radius:10px;padding:13px;font-weight:600;text-decoration:none">See all ${n} →</a></p>`,
  );
  h.push(`<p style="color:${C.muted};font-size:12px;text-align:center;margin:0">This link opens your list without the passcode.</p>`);
  h.push(`</div>`);
  t.push("", `See all ${n}: ${links.open}`);

  return { subject, html: h.join("\n"), text: t.join("\n") };
}
