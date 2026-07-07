"use client";

export interface CsvRow {
  name: string;
  email: string;
  score: number | null;
  total: number | null;
  violations: number;
  autoSubmitted: boolean;
  submittedAt: string | null;
}

export default function DownloadCsvButton({
  rows,
  fileName,
}: {
  rows: CsvRow[];
  fileName: string;
}) {
  function download() {
    const esc = (v: string | number | null) =>
      `"${String(v ?? "").replaceAll('"', '""')}"`;
    const lines = [
      ["Name", "Email", "Score", "Total", "Violations", "Auto-submitted", "Submitted at"].join(","),
      ...rows.map((r) =>
        [
          esc(r.name),
          esc(r.email),
          esc(r.score),
          esc(r.total),
          esc(r.violations),
          esc(r.autoSubmitted ? "Yes" : "No"),
          esc(r.submittedAt ? new Date(r.submittedAt).toLocaleString() : ""),
        ].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={download}
      disabled={rows.length === 0}
      className="text-sm rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
    >
      ⬇ Download CSV
    </button>
  );
}
