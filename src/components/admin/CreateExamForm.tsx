"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateExamForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, duration_minutes: duration }),
    });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "Could not create exam");
      return;
    }
    router.push(`/admin/exam/${body.exam.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={create}
      className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-end gap-3"
    >
      <div className="flex-1 min-w-48">
        <label className="block text-sm font-medium text-slate-700 mb-1">Exam title</label>
        <input
          type="text"
          required
          minLength={2}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Aptitude Test – Week 3"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Duration (minutes)</label>
        <input
          type="number"
          required
          min={1}
          max={600}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-28 rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-indigo-600 text-white font-medium py-2 px-5 hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create exam"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
