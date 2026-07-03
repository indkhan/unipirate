import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-bold">UniPirate</h1>
      <p className="text-muted-foreground">
        Your guided path to studying in Germany.
      </p>
      <Link href="/login" className="underline">
        Log in
      </Link>
    </main>
  );
}
