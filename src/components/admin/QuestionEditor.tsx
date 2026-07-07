"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface EditableQuestion {
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct: string;
  section: string;
}

const OPTION_KEYS = ["a", "b", "c", "d"] as const;

const EMPTY_ROW: EditableQuestion = {
  question: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct: "A",
  section: "",
};

export default function QuestionEditor({
  examId,
  questions,
  editable,
}: {
  examId: string;
  questions: EditableQuestion[];
  editable: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<EditableQuestion[]>(questions);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(index: number, field: keyof EditableQuestion, value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
    setDirty(true);
    setError(null);
  }

  function remove(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
    setError(null);
  }

  function addRow() {
    setRows((prev) => [...prev, { ...EMPTY_ROW }]);
    setDirty(true);
  }

  async function save() {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.question.trim() || !r.option_a.trim() || !r.option_b.trim() || !r.option_c.trim() || !r.option_d.trim()) {
        setError(`Question ${i + 1} has an empty field — fill everything before saving.`);
        return;
      }
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/exams/${examId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions: rows }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Could not save changes");
      return;
    }
    setDirty(false);
    router.refresh();
  }

  if (rows.length === 0 && !editable) return null;

  // ---------- read-only view (exam is live or ended) ----------
  if (!editable) {
    return (
      <section className="card overflow-hidden">
        <div className="p-5 border-b border-line">
          <h2 className="font-display font-bold text-ink">
            Questions
            <span className="text-muted font-sans font-normal text-sm ml-2">
              {rows.length} total · read-only after the exam starts
            </span>
          </h2>
        </div>
        <div className="divide-y divide-line max-h-[32rem] overflow-y-auto">
          {rows.map((q, i) => (
            <div key={i} className="p-5">
              <p className="font-semibold text-ink text-sm leading-relaxed whitespace-pre-wrap mb-2.5">
                <span className="text-muted mr-1.5">{i + 1}.</span>
                {q.question}
                {q.section && (
                  <span className="pill bg-indigo-50 text-primary ml-2 align-middle">
                    {q.section}
                  </span>
                )}
              </p>
              <div className="grid sm:grid-cols-2 gap-1.5 text-sm">
                {OPTION_KEYS.map((k) => {
                  const isCorrect = q.correct === k.toUpperCase();
                  return (
                    <div
                      key={k}
                      className={`rounded-lg border px-3 py-1.5 flex items-center gap-2 ${
                        isCorrect ? "border-emerald-300 bg-emerald-50/70" : "border-line"
                      }`}
                    >
                      <span
                        className={`shrink-0 w-5 h-5 rounded text-[11px] font-bold flex items-center justify-center ${
                          isCorrect ? "bg-emerald-600 text-white" : "bg-slate-100 text-muted"
                        }`}
                      >
                        {k.toUpperCase()}
                      </span>
                      <span className="text-ink">{q[`option_${k}`]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // ---------- editable view (draft) ----------
  return (
    <section className="card overflow-hidden">
      <div className="p-5 flex items-center justify-between flex-wrap gap-3 border-b border-line">
        <h2 className="font-display font-bold text-ink">
          Questions
          <span className="text-muted font-sans font-normal text-sm ml-2">
            {rows.length} total — click any text to edit
          </span>
        </h2>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="pill bg-amber-50 text-amber-700">Unsaved changes</span>
          )}
          <button onClick={addRow} className="btn btn-sm btn-outline">
            + Add question
          </button>
          <button
            onClick={save}
            disabled={saving || !dirty || rows.length === 0}
            className="btn btn-sm btn-primary"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mx-5 mt-4 flex items-start gap-2 text-sm text-danger bg-red-50 border border-red-100 rounded-xl p-3.5">
          <span aria-hidden>⚠</span> {error}
        </p>
      )}

      {rows.length === 0 ? (
        <div className="p-10 text-center">
          <p className="font-semibold text-ink text-sm">No questions yet</p>
          <p className="text-sm text-muted mt-1">
            Upload an Excel sheet above, or add questions manually.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {rows.map((q, i) => (
            <div key={i} className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <span className="pill bg-indigo-50 text-primary">Q{i + 1}</span>
                <button
                  onClick={() => remove(i)}
                  className="text-xs font-semibold text-muted hover:text-danger transition-colors"
                  title="Delete this question"
                >
                  ✕ Remove
                </button>
              </div>
              <textarea
                value={q.question}
                onChange={(e) => update(i, "question", e.target.value)}
                rows={2}
                placeholder="Question text"
                className="field resize-y mb-3 text-sm"
              />
              <div className="grid sm:grid-cols-2 gap-2.5">
                {OPTION_KEYS.map((k) => (
                  <div key={k} className="flex items-center gap-2">
                    <span
                      className={`shrink-0 w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center ${
                        q.correct === k.toUpperCase()
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-muted"
                      }`}
                    >
                      {k.toUpperCase()}
                    </span>
                    <input
                      type="text"
                      value={q[`option_${k}`]}
                      onChange={(e) => update(i, `option_${k}`, e.target.value)}
                      placeholder={`Option ${k.toUpperCase()}`}
                      className="field text-sm py-2"
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-3">
                <div className="flex items-center gap-2.5">
                  <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                    Correct answer
                  </label>
                  <div className="flex gap-1.5">
                    {OPTION_KEYS.map((k) => (
                      <button
                        key={k}
                        onClick={() => update(i, "correct", k.toUpperCase())}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                          q.correct === k.toUpperCase()
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-muted hover:bg-slate-200"
                        }`}
                      >
                        {k.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                    Section
                  </label>
                  <input
                    type="text"
                    value={q.section}
                    onChange={(e) => update(i, "section", e.target.value)}
                    placeholder="e.g. Aptitude"
                    maxLength={40}
                    className="field text-sm py-1.5 w-40"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <div className="p-4 border-t border-line flex justify-end">
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="btn btn-primary"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </section>
  );
}
