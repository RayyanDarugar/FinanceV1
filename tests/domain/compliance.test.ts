import { complianceDeadline } from "@/lib/domain/compliance";

const TZ = "America/Los_Angeles";

test("submit-by is start date minus lead days, in PT", () => {
  const d = complianceDeadline("2026-12-10T18:30:00-08:00", 7, new Date("2026-11-18T17:00:00Z"), TZ);
  expect(d).toEqual({ submitBy: "2026-12-03", daysLeft: 15, passed: false });
});

test("late-evening PT event does not shift a day when server is UTC", () => {
  const d = complianceDeadline("2026-12-10T23:00:00-08:00", 7, new Date("2026-11-18T17:00:00Z"), TZ);
  expect(d.submitBy).toBe("2026-12-03");
});

test("passed deadline", () => {
  const d = complianceDeadline("2026-12-05T18:00:00-08:00", 7, new Date("2026-12-01T17:00:00Z"), TZ);
  expect(d).toEqual({ submitBy: "2026-11-28", daysLeft: 0, passed: true });
});

test("deadline today is not passed", () => {
  const d = complianceDeadline("2026-12-10T18:30:00-08:00", 7, new Date("2026-12-03T20:00:00Z"), TZ);
  expect(d).toEqual({ submitBy: "2026-12-03", daysLeft: 0, passed: false });
});
