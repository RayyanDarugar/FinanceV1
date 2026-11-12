import { createMemoryRepo } from "@/lib/db/memoryRepo";
import { applyOutcome, readOutcomeToken } from "@/lib/email/outcome";
import { sendEmail } from "@/lib/email/send";
import { buildWeeklyEmail } from "@/lib/email/weekly";
import { signToken, verifyToken } from "@/lib/auth/tokens";
import { makeFixtures } from "@/lib/fixtures";
import { NOW } from "../helpers/make";

const SECRET = "test-secret-1234567890";

describe("sendEmail", () => {
  test("passes to and cc through to the gmail transport", async () => {
    const sendMail = vi.fn(async () => ({}));
    await sendEmail(
      { to: ["a@x.com", "b@x.com"], cc: ["c@x.com"], subject: "S", html: "<p>h</p>", text: "t" },
      { provider: "gmail", gmail: { sendMail }, from: "me@gmail.com" },
    );
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "a@x.com, b@x.com", cc: "c@x.com", subject: "S", from: "Event Finder <me@gmail.com>" }));
  });

  test("resend provider posts to the Resend API", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ id: "1" }));
    await sendEmail(
      { to: ["a@x.com"], cc: ["c@x.com"], subject: "S", html: "h", text: "t" },
      { provider: "resend", fetchImpl: fetchImpl as unknown as typeof fetch, resendKey: "rk", from: "events@d.com" },
    );
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(String(init.body))).toMatchObject({ to: ["a@x.com"], cc: ["c@x.com"], from: "events@d.com" });
  });

  test("a failed Resend call throws so the run can retry", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 500 }));
    await expect(
      sendEmail({ to: ["a@x.com"], cc: [], subject: "S", html: "h", text: "t" }, { provider: "resend", fetchImpl: fetchImpl as never, resendKey: "k", from: "f" }),
    ).rejects.toThrow();
  });
});

async function seeded() {
  const repo = createMemoryRepo();
  const { profile, events, orgs } = makeFixtures(NOW);
  await repo.putProfile(profile, "h");
  await repo.upsertOrgs(profile.id, orgs);
  await repo.upsertEvents(profile.id, "r0", events.map((e) => ({ ...e, dedupeKey: e.id, raw: {} })));
  return { repo, profile };
}

describe("outcome links", () => {
  test("reading the token (GET) never records anything", async () => {
    const { repo, profile } = await seeded();
    const spy = vi.spyOn(repo, "recordOutcome");
    const token = await signToken({ pid: profile.id, eventId: "ev-solana-mixer-past", n: 2, purpose: "outcome" }, 3600, SECRET);
    const info = await readOutcomeToken(repo, token, SECRET);
    expect(info).toMatchObject({ ok: true, n: 2, title: "Solana Beach Chamber Business Mixer" });
    expect(spy).not.toHaveBeenCalled();
  });

  test("applying a valid token (POST) records the answer and note", async () => {
    const { repo, profile } = await seeded();
    const token = await signToken({ pid: profile.id, eventId: "ev-solana-mixer-past", n: 3, purpose: "outcome" }, 3600, SECRET);
    expect(await applyOutcome(repo, token, "met a widow planning to retire", SECRET)).toMatchObject({ ok: true });
    expect(await repo.getEvent("ev-solana-mixer-past")).toMatchObject({ outcome: 3, outcomeNote: "met a widow planning to retire" });
  });

  test("an expired or login token can't record an outcome", async () => {
    const { repo, profile } = await seeded();
    const expired = await signToken({ pid: profile.id, eventId: "ev-solana-mixer-past", n: 1, purpose: "outcome" }, 60, SECRET, new Date(Date.now() - 3600_000));
    expect(await applyOutcome(repo, expired, "", SECRET)).toMatchObject({ ok: false });
    const login = await signToken({ pid: profile.id, purpose: "login" }, 3600, SECRET);
    expect(await applyOutcome(repo, login, "", SECRET)).toMatchObject({ ok: false });
  });
});

describe("buildWeeklyEmail", () => {
  test("uses the profile's recipients and signed links", async () => {
    const { repo, profile } = await seeded();
    const msg = await buildWeeklyEmail(repo, profile, NOW, "https://app.test", SECRET);
    expect(msg.to).toEqual(profile.emailTo);
    expect(msg.cc).toEqual(profile.emailCc);
    expect(msg.subject).toMatch(/^Your \d+ picks this week$/);
    const open = msg.html.match(/https:\/\/app\.test\/r\/([^"&]+)/)![1];
    expect(await verifyToken(open, SECRET)).toMatchObject({ pid: profile.id, purpose: "login" });
    expect(msg.html).toContain("https://app.test/outcome/");
    expect(msg.html).toContain("Solana Beach Chamber Business Mixer");
  });
});
