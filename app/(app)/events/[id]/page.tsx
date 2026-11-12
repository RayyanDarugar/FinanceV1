import { EventsView } from "@/components/EventsView";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EventsView selectedId={id} />;
}
