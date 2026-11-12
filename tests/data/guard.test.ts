import { dataApiEnabled } from "@/lib/auth/session";

test("I5: the live data API is off unless the build is in live mode", () => {
  expect(dataApiEnabled("fake")).toBe(false);
  expect(dataApiEnabled(undefined)).toBe(false);
  expect(dataApiEnabled("live")).toBe(true);
});
