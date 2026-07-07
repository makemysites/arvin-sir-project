"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <main className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-xl font-bold text-slate-900 mb-1">Welcome! One last step</h1>
        <p className="text-sm text-slate-500 mb-4">
          Enter your full name — this is how you will appear on the leaderboard.
        </p>
        <form onSubmit={save} className="space-y-4">
          <input
            type="text"
            required
            minLength={2}
            maxLength={80}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={loading || name.trim().length < 2}
            className="w-full rounded-lg bg-indigo-600 text-white font-medium py-2.5 hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Continue"}
          </button>
        </form>
        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
      </div>
    </main>
  );
}
