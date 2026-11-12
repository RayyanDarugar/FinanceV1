import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Event Finder</h1>
      {expired ? (
        <p className="mt-2 rounded-lg bg-amber-soft px-3 py-2 text-amber">This link has expired. Enter your passcode to continue.</p>
      ) : (
        <p className="mt-1 text-muted">Enter your passcode to see this week&apos;s picks.</p>
      )}
      <LoginForm />
    </main>
  );
}
