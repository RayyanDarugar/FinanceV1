import { ChangeBox } from "@/components/ChangeBox";
import { PrototypeNote } from "@/components/PrototypeNote";
import { Tabs } from "@/components/Tabs";

// Access is enforced by middleware.ts.
export default function AppLayout({ children }: { children: React.ReactNode }) {
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
