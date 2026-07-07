"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ExamStatus } from "@/lib/types";

export default function StatusControls({
  examId,
  status,
  questionCount,
}: {
  examId: string;
  status: ExamStatus;
  questionCount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(next: ExamStatus) {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/exams/${examId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "Could not update status");
      return;
    }
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this exam and all its questions and results? This cannot be undone.")) return;
    setLoading(true);
    const res = await fetch(`/api/admin/exams/${examId}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) {
      router.push("/admin");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {status === "draft" && (
        <button
          onClick={() => {
            if (questionCount === 0) {
              setError("Upload questions first.");
              return;
            }
            if (confirm("Start the exam now? Students will be able to join immediately.")) {
              setStatus("live");
            }
          }}
          disabled={loading}
          className="btn btn-success"
        >
          ▶ Start exam
        </button>
      )}
      {status === "live" && (
        <button
          onClick={() => {
            if (
              confirm(
                "End the exam now? Students still writing will be auto-submitted, and everyone will be able to see the answers and leaderboard."
              )
            ) {
              setStatus("ended");
            }
          }}
          disabled={loading}
          className="btn btn-danger"
        >
          ■ End exam
        </button>
      )}
      <button
        onClick={remove}
        disabled={loading}
        className="text-sm font-medium text-muted hover:text-danger transition-colors disabled:opacity-50"
      >
        Delete
      </button>
      {error && <p className="w-full text-sm text-danger">{error}</p>}
    </div>
  );
}
