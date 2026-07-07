"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export interface MaterialItem {
  id: string;
  filename: string;
  title: string;
  size: number;
  uploadedAt: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MaterialsManager({ materials }: { materials: MaterialItem[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("title", title);
    const res = await fetch("/api/admin/materials", { method: "POST", body: form });
    const body = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) {
      setError(body.error ?? "Upload failed");
      return;
    }
    setTitle("");
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"? Students will no longer be able to download it.`)) return;
    await fetch(`/api/admin/materials/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="card p-6 space-y-5">
      <div>
        <h3 className="font-display font-bold text-ink">Study materials</h3>
        <p className="text-sm text-muted mt-0.5">
          Upload notes and PDFs (max 4 MB each) — students can download them from their
          dashboard.
        </p>
      </div>

      <form onSubmit={upload} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm font-semibold text-ink mb-1.5">File</label>
          <input
            ref={fileRef}
            type="file"
            className="block text-sm text-muted file:mr-3 file:btn file:btn-sm file:btn-outline file:cursor-pointer"
          />
        </div>
        <div className="flex-1 min-w-48">
          <label className="block text-sm font-semibold text-ink mb-1.5">
            Title <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Percentages – practice set"
            maxLength={120}
            className="field"
          />
        </div>
        <button type="submit" disabled={uploading} className="btn btn-primary">
          {uploading ? "Uploading…" : "⬆ Upload"}
        </button>
      </form>

      {error && (
        <p className="flex items-start gap-2 text-sm text-danger bg-red-50 border border-red-100 rounded-xl p-3.5">
          <span aria-hidden>⚠</span> {error}
        </p>
      )}

      {materials.length > 0 && (
        <div className="border border-line rounded-xl divide-y divide-line overflow-hidden">
          {materials.map((m) => (
            <div key={m.id} className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="h-10 w-10 shrink-0 rounded-xl bg-slate-50 border border-line flex items-center justify-center text-lg">
                  📚
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-ink text-sm truncate">{m.title}</p>
                  <p className="text-xs text-muted">
                    {m.filename} · {formatBytes(m.size)} ·{" "}
                    {new Date(m.uploadedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={`/api/materials/${m.id}`} className="btn btn-sm btn-outline">
                  ⬇ Download
                </a>
                <button
                  onClick={() => remove(m.id, m.title)}
                  className="text-xs font-semibold text-muted hover:text-danger transition-colors px-2 py-1"
                >
                  ✕ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
