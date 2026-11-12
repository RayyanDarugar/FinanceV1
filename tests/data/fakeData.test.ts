import { createFakeData } from "@/lib/data/fakeData";
import { NOW } from "../helpers/make";
import { runAppDataContract } from "./contract";

const now = () => NOW;

beforeEach(() => localStorage.clear());

runAppDataContract("fake (prototype)", () => createFakeData(localStorage, now));

test("fake state survives a new createFakeData on the same storage", async () => {
  const a = createFakeData(localStorage, now);
  const [first] = await a.listEvents();
  await a.setMark(first.id, "saved");
  const b = createFakeData(localStorage, now);
  expect((await b.getEvent(first.id))?.mark).toBe("saved");
});
