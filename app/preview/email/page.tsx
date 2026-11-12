import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { EmailPreview } from "@/components/EmailPreview";
import { SESSION_COOKIE } from "@/lib/auth/session";

export default async function EmailPreviewPage() {
  if (!(await cookies()).get(SESSION_COOKIE)) redirect("/login");
  return <EmailPreview />;
}
