"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface EditableQuestion {
  id?: string | null; // set for questions already saved in the database
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct: string;
  section: string;
  explanation_image_id?: string | null;
}

const OPTION_KEYS = ["a", "b", "c", "d"] as const;

const EMPTY_ROW: EditableQuestion = {
  id: null,
  question: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct: "A",
  section: "",
  explanation_image_id: null,
};

// Shrinks big photos so they upload fast and fit the 4 MB server cap.
async function compressImage(file: File): Promise<Blob> {
  const MAX_DIM = 1600;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= 1.5 * 1024 * 1024) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85)
  );
  return blob ?? file;
}

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
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update(index: number, field: keyof EditableQuestion, value: string | null) {
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

  async function uploadImage(file: File): Promise<string> {
    if (!file.type.startsWith("image/")) {
      throw new Error("Only image files are allowed (JPG, PNG, …)");
    }
    const blob = await compressImage(file);
    const form = new FormData();
    form.append("file", new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }));
    const res = await fetch(`/api/admin/exams/${examId}/explanations`, {
      method: "POST",
      body: form,
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Image upload failed");
    return body.imageId as string;
  }

  // Draft mode: the image id is kept in the row and persisted by "Save changes".
  async function onPickImageDraft(index: number, file: File | undefined) {
    if (!file) return;
    setUploadingIndex(index);
    setError(null);
    try {
      const imageId = await uploadImage(file);
      update(index, "explanation_image_id", imageId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploadingIndex(null);
    }
  }

  // Live/ended mode: attach directly to the saved question.
  async function onPickImageLive(index: number, file: File | undefined) {
    const questionId = rows[index]?.id;
    if (!file || !questionId) return;
    setUploadingIndex(index);
    setError(null);
    try {
      const imageId = await uploadImage(file);
      const res = await fetch(`/api/admin/questions/${questionId}/explanation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      });
      if (!res.ok) throw new Error("Could not attach the image");
      setRows((prev) =>
        prev.map((r, i) => (i === index ? { ...r, explanation_image_id: imageId } : r))
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploadingIndex(null);
    }
  }

  async function onRemoveImageLive(index: number) {
    const questionId = rows[index]?.id;
    if (!questionId) return;
    await fetch(`/api/admin/questions/${questionId}/explanation`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId: null }),
    });
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, explanation_image_id: null } : r))
    );
    router.refresh();
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

  function explanationControl(index: number, mode: "draft" | "live") {
    const row = rows[index];
    const busy = uploadingIndex === index;
    const onPick = mode === "draft" ? onPickImageDraft : onPickImageLive;
    return (
      <div className="mt-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold text-muted uppercase tracking-wider">
            Explanation image
          </label>
          <label className={`btn btn-sm btn-outline cursor-pointer ${busy ? "opacity-50 pointer-events-none" : ""}`}>
            {busy ? "Uploading…" : row.explanation_image_id ? "🖼 Change" : "🖼 Add image"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                onPick(index, e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {row.explanation_image_id && (
            <button
              onClick={() =>
                mode === "draft"
                  ? update(index, "explanation_image_id", null)
                  : onRemoveImageLive(index)
              }
              className="text-xs font-semibold text-muted hover:text-danger transition-colors"
            >
              ✕ Remove image
            </button>
          )}
        </div>
        {row.explanation_image_id && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/explanations/${row.explanation_image_id}`}
            alt={`Explanation for question ${index + 1}`}
            className="mt-2.5 rounded-xl border border-line max-h-56 w-auto"
          />
        )}
      </div>
    );
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
              {rows.length} total · text is read-only after the exam starts, but you can still
              add explanation images
            </span>
          </h2>
        </div>
        {error && (
          <p className="mx-5 mt-4 flex items-start gap-2 text-sm text-danger bg-red-50 border border-red-100 rounded-xl p-3.5">
            <span aria-hidden>⚠</span> {error}
          </p>
        )}
        <div className="divide-y divide-line max-h-[40rem] overflow-y-auto">
          {rows.map((q, i) => (
            <div key={q.id ?? i} className="p-5">
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
              {explanationControl(i, "live")}
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
              {explanationControl(i, "draft")}
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
