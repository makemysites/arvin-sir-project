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
    <form onSubmit={create} className="card p-6 flex flex-wrap items-end gap-4">
      <div className="flex-1 min-w-52">
        <label className="block text-sm font-semibold text-ink mb-1.5">Exam title</label>
        <input
          type="text"
          required
          minLength={2}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Aptitude Test – Week 3"
          className="field"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-ink mb-1.5">Duration (min)</label>
        <input
          type="number"
          required
          min={1}
          max={600}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="field w-28"
        />
      </div>
      <button type="submit" disabled={loading} className="btn btn-primary">
        {loading ? "Creating…" : "+ Create exam"}
      </button>
      {error && <p className="w-full text-sm text-danger">{error}</p>}
    </form>
  );
}
