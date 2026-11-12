import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ChangeBox } from "@/components/ChangeBox";
import { PrototypeNote } from "@/components/PrototypeNote";
import { Tabs } from "@/components/Tabs";
import { SESSION_COOKIE } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await cookies()).get(SESSION_COOKIE)) redirect("/login");
  return (
    <div className="mx-auto max-w-6xl px-3 pb-16 pt-4 sm:px-5">
      <header className="space-y-3">
        <h1 className="px-1 text-xl font-semibold">Event Finder</h1>
        <Tabs />
        <ChangeBox />
      </header>
      <main className="mt-4">{children}</main>
      <PrototypeNote />
    </div>
  );
}
