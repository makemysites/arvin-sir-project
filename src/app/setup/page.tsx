"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";

export default function SetupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: name.trim() }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Could not save your name. Please try again.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="aurora relative flex-1 flex items-center justify-center p-4 overflow-hidden">
      <div className="dotgrid absolute inset-0" aria-hidden />

      <div className="relative w-full max-w-md fade-up">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo className="h-14 w-14 mb-4" />
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Welcome aboard 👋
          </h1>
          <p className="text-muted mt-2 text-[15px]">
            Tell us your name — it&apos;s how you&apos;ll appear on the leaderboard.
          </p>
        </div>

        <div className="card p-7">
          <form onSubmit={save} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-ink mb-1.5">
                Full name
              </label>
              <input
                id="name"
                type="text"
                required
                minLength={2}
                maxLength={80}
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Abhinay Kumar"
                className="field"
              />
            </div>
            <button
              type="submit"
              disabled={loading || name.trim().length < 2}
              className="btn btn-lg btn-primary w-full"
            >
              {loading ? "Saving…" : "Continue →"}
            </button>
          </form>
          {error && (
            <p className="flex items-start gap-2 text-sm text-danger bg-red-50 border border-red-100 rounded-xl p-3.5 mt-5">
              <span aria-hidden>⚠</span> {error}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
