"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviewForm({
  examId,
  initialRating,
  initialComment,
}: {
  examId: string;
  initialRating: number | null;
  initialComment: string;
}) {
  const router = useRouter();
  const [rating, setRating] = useState<number>(initialRating ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(initialComment);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyReviewed = initialRating !== null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setError("Pick a star rating first.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examId, rating, comment }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Could not save your review");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="card p-6 mb-8 fade-up">
      <h2 className="font-display font-bold text-ink">
        {alreadyReviewed ? "Your review" : "How was this exam?"}
      </h2>
      <p className="text-sm text-muted mt-0.5 mb-4">
        {alreadyReviewed
          ? "You can update it any time — your teacher sees the latest version."
          : "Leave a quick review for your teacher — it helps improve the next test."}
      </p>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={rating === star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              className={`text-3xl leading-none transition-transform hover:scale-110 ${
                star <= (hover || rating) ? "text-amber-400" : "text-slate-200"
              }`}
            >
              ★
            </button>
          ))}
          {rating > 0 && (
            <span className="text-sm text-muted ml-2">{rating}/5</span>
          )}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="What did you think? Was it too easy, too hard, any topics you want more practice on…"
          className="field resize-y text-sm"
        />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? "Saving…" : alreadyReviewed ? "Update review" : "Submit review"}
          </button>
          {saved && <span className="text-sm font-medium text-success">✓ Sent to your teacher</span>}
        </div>
      </form>
      {error && <p className="text-sm text-danger mt-3">{error}</p>}
    </div>
  );
}
