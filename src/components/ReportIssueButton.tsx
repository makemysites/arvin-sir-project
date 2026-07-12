"use client";

import { useState } from "react";

const ISSUE_CATEGORIES = [
  "False violation warning",
  "Screen went to sleep",
  "App crashed / froze",
  "Question display issue",
  "Timer issue",
  "Other",
] as const;

type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export default function ReportIssueButton({
  examId,
  attemptId,
}: {
  examId: string;
  attemptId: string;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<IssueCategory | "">("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category) {
      setError("Please select an issue category.");
      return;
    }
    if (description.trim().length < 5) {
      setError("Please describe the issue in at least a few words.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId, attemptId, category, description: description.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Could not submit your report. Please try again.");
        return;
      }
      setSubmitted(true);
      setTimeout(() => {
        setOpen(false);
        // Reset after close animation
        setTimeout(() => {
          setSubmitted(false);
          setCategory("");
          setDescription("");
        }, 300);
      }, 1800);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="report-issue-fab"
        title="Report an issue"
        aria-label="Report an issue"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 11.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Zm.75-3.25a.75.75 0 0 1-1.5 0V6.5a.75.75 0 0 1 1.5 0v3.75Z"
            fill="currentColor"
          />
        </svg>
        <span className="hidden sm:inline">Report Issue</span>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-[60] bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="report-issue-modal card max-w-md w-full p-0 fade-up overflow-hidden">
            {/* Header */}
            <div className="report-issue-header px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center text-lg">
                    🐛
                  </span>
                  <div>
                    <h2 className="font-display font-bold text-white text-base">Report an Issue</h2>
                    <p className="text-white/70 text-xs mt-0.5">
                      Your teacher will review this after the exam
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 flex items-center justify-center transition-colors"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {submitted ? (
              <div className="px-6 py-10 text-center">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-2xl mb-4">
                  ✅
                </div>
                <p className="font-display font-bold text-ink">Issue reported</p>
                <p className="text-sm text-muted mt-1">
                  Your teacher will see this in their dashboard.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted block mb-1.5">
                    What happened?
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as IssueCategory)}
                    className="field text-sm"
                  >
                    <option value="" disabled>
                      Select an issue type…
                    </option>
                    {ISSUE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted block mb-1.5">
                    Describe the issue
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="E.g. My screen went to sleep after 5 minutes and I got a violation warning even though I was actively working…"
                    className="field text-sm resize-y"
                  />
                  <p className="text-[11px] text-muted mt-1 text-right">
                    {description.length}/1000
                  </p>
                </div>
                {error && (
                  <p className="flex items-start gap-2 text-sm text-danger bg-red-50 border border-red-100 rounded-xl p-3">
                    <span aria-hidden>⚠</span> {error}
                  </p>
                )}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="btn btn-outline flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn btn-primary flex-1"
                  >
                    {submitting ? "Sending…" : "Submit Report"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
