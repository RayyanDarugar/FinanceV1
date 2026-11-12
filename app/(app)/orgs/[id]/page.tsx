import { OrgDetail } from "@/components/OrgDetail";

export default async function OrgPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrgDetail id={id} />;
}
