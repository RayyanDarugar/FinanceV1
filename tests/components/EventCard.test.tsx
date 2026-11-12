import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventCard } from "@/components/EventCard";
import { makeEvent, makeProfile, NOW } from "../helpers/make";

const profile = makeProfile();

function setup(overrides = {}) {
  const onMark = vi.fn();
  const event = makeEvent(overrides);
  render(<EventCard event={event} profile={profile} now={NOW} onMark={onMark} href={`/events/${event.id}`} />);
  return { onMark, event };
}

test("asked speaking event shows 'They're asking for speakers'", () => {
  setup({ speaking: "asked" });
  expect(screen.getByText(/They're asking for speakers/)).toBeInTheDocument();
});

test("could_offer shows 'You could offer to speak' and never says 'asking'", () => {
  const { container } = render(
    <EventCard event={makeEvent({ speaking: "could_offer" })} profile={profile} now={NOW} onMark={vi.fn()} href="/x" />,
  );
  expect(screen.getByText(/You could offer to speak/)).toBeInTheDocument();
  expect(container.textContent).not.toMatch(/asking/i);
});

test("compliance strip shows the submit-by date and days left", () => {
  setup({ needsPreapproval: true, startsAt: "2026-12-10T18:30:00-08:00" });
  expect(screen.getByText("Needs LPL pre-approval · submit by Dec 3 (15 days left)")).toBeInTheDocument();
});

test("compliance strip says when the deadline has passed", () => {
  setup({ needsPreapproval: true, startsAt: "2026-11-23T18:00:00-08:00" });
  expect(screen.getByText("Needs LPL pre-approval · Deadline passed Nov 16")).toBeInTheDocument();
});

test("Hide shows the five reasons and records the chosen one", async () => {
  const { onMark, event } = setup();
  await userEvent.click(screen.getByRole("button", { name: /Hide/ }));
  for (const r of ["Too far", "Wrong crowd", "Too expensive", "Bad timing", "Not my kind of event"]) {
    expect(screen.getByRole("button", { name: r })).toBeInTheDocument();
  }
  await userEvent.click(screen.getByRole("button", { name: "Too far" }));
  expect(onMark).toHaveBeenCalledWith(event.id, "hidden", "too_far");
});

test("Hide can skip the reason", async () => {
  const { onMark, event } = setup();
  await userEvent.click(screen.getByRole("button", { name: /Hide/ }));
  await userEvent.click(screen.getByRole("button", { name: /Skip/ }));
  expect(onMark).toHaveBeenCalledWith(event.id, "hidden", null);
});

test("Save and I'm going toggle", async () => {
  const { onMark, event } = setup({ mark: "saved" });
  await userEvent.click(screen.getByRole("button", { name: /Saved/ }));
  expect(onMark).toHaveBeenCalledWith(event.id, null, null);
  await userEvent.click(screen.getByRole("button", { name: /I'm going/ }));
  expect(onMark).toHaveBeenCalledWith(event.id, "going", null);
});

test("unknown cost renders 'Cost: check event page'", () => {
  setup({ costUsd: null });
  expect(screen.getByText("Cost: check event page")).toBeInTheDocument();
});
