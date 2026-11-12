import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrgCard, SuggestionCard } from "@/components/OrgCard";
import { makeOrg } from "../helpers/make";

test("tapping 'I contacted them' calls back and removes the not-contacted strip", async () => {
  const onContacted = vi.fn();
  const org = { ...makeOrg({ name: "CSUSM" }), nudges: [{ kind: "not_contacted" as const, text: "You haven't contacted them yet." }] };
  render(<OrgCard org={org} onContacted={onContacted} href="/orgs/x" />);
  expect(screen.getByText("You haven't contacted them yet.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /I contacted them/ }));
  expect(onContacted).toHaveBeenCalledWith(org.id);
  expect(screen.queryByText("You haven't contacted them yet.")).not.toBeInTheDocument();
});

test("hosting nudge stays after contacting", async () => {
  const org = {
    ...makeOrg(),
    nudges: [{ kind: "hosting" as const, eventId: "e1", text: "Hosting Gala Dec 12. Good time to reach out." }],
  };
  render(<OrgCard org={org} onContacted={vi.fn()} href="/orgs/x" />);
  await userEvent.click(screen.getByRole("button", { name: /I contacted them/ }));
  expect(screen.getByText("Hosting Gala Dec 12. Good time to reach out.")).toBeInTheDocument();
});

test("suggestion card offers Follow and Not interested", async () => {
  const onStatus = vi.fn();
  const org = makeOrg({ status: "suggested" });
  render(<SuggestionCard org={org} onStatus={onStatus} href="/orgs/x" />);
  await userEvent.click(screen.getByRole("button", { name: "+ Follow" }));
  expect(onStatus).toHaveBeenCalledWith(org.id, "following");
  await userEvent.click(screen.getByRole("button", { name: "✕ Not interested" }));
  expect(onStatus).toHaveBeenCalledWith(org.id, "not_interested");
});
