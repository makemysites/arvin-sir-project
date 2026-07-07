"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

interface ParsedQuestion {
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct: string;
}

// Expected sheet layout: column 1 = question, columns 2-5 = options A-D,
// column 6 = correct option (A/B/C/D). A header row is detected and skipped.
function parseSheet(data: ArrayBuffer): { questions: ParsedQuestion[]; problems: string[] } {
  const workbook = XLSX.read(data, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const questions: ParsedQuestion[] = [];
  const problems: string[] = [];

  rows.forEach((row, index) => {
    const cells = row.map((c) => String(c ?? "").trim());
    if (cells.every((c) => c === "")) return; // skip blank rows

    const [question, a, b, c, d, correctRaw] = cells;
    const correct = (correctRaw ?? "").toUpperCase();

    // Skip a header row like "Question | A | B | C | D | Correct"
    if (index === 0 && !["A", "B", "C", "D"].includes(correct)) return;

    if (!question || !a || !b || !c || !d) {
      problems.push(`Row ${index + 1}: has empty cells`);
      return;
    }
    if (!["A", "B", "C", "D"].includes(correct)) {
      problems.push(`Row ${index + 1}: correct answer must be A, B, C or D (got "${correctRaw}")`);
      return;
    }
    questions.push({ question, option_a: a, option_b: b, option_c: c, option_d: d, correct });
  });

  return { questions, problems };
}

export default function QuestionUpload({
  examId,
  existingCount,
}: {
  examId: string;
  existingCount: number;
}) {
  const router = useRouter();
  const [parsed, setParsed] = useState<ParsedQuestion[] | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const result = parseSheet(buffer);
      setParsed(result.questions);
      setProblems(result.problems);
    } catch {
      setError("Could not read that file. Make sure it is a valid .xlsx/.xls/.csv file.");
      setParsed(null);
    }
    e.target.value = "";
  }

  async function save() {
    if (!parsed?.length) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/exams/${examId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions: parsed }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Upload failed");
      return;
    }
    setParsed(null);
    setProblems([]);
    setFileName("");
    router.refresh();
  }

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-display font-bold text-ink">Questions</h3>
          <p className="text-sm text-muted mt-0.5">
            {existingCount > 0
              ? `${existingCount} question${existingCount > 1 ? "s" : ""} uploaded — uploading a new file replaces them.`
              : "Upload your Excel sheet to add questions."}
          </p>
        </div>
      </div>

      {parsed === null && (
        <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-line hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors p-8 text-center">
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="hidden" />
          <div className="mx-auto h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center text-xl mb-3">
            📄
          </div>
          <p className="font-semibold text-ink text-sm">
            Click to choose an Excel file
          </p>
          <p className="text-xs text-muted mt-1.5">
            Columns: Question · Option A · B · C · D · Correct (A/B/C/D) — .xlsx, .xls or .csv
          </p>
        </label>
      )}

      {problems.length > 0 && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="font-semibold mb-1.5">Some rows were skipped:</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {problems.slice(0, 8).map((p, i) => (
              <li key={i}>{p}</li>
            ))}
            {problems.length > 8 && <li>…and {problems.length - 8} more</li>}
          </ul>
        </div>
      )}

      {parsed !== null && (
        <>
          {parsed.length === 0 ? (
            <p className="text-sm text-danger">
              No valid questions found in {fileName}. Check the column order.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm">
                <span className="pill bg-emerald-50 text-emerald-700">
                  ✓ {parsed.length} questions parsed
                </span>
                <span className="text-muted text-xs">{fileName}</span>
              </div>
              <div className="border border-line rounded-xl overflow-auto max-h-72">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="text-left text-muted uppercase tracking-wider">
                      <th className="px-3 py-2.5 w-8 font-semibold">#</th>
                      <th className="px-3 py-2.5 font-semibold">Question</th>
                      <th className="px-3 py-2.5 font-semibold">A</th>
                      <th className="px-3 py-2.5 font-semibold">B</th>
                      <th className="px-3 py-2.5 font-semibold">C</th>
                      <th className="px-3 py-2.5 font-semibold">D</th>
                      <th className="px-3 py-2.5 w-14 font-semibold">Ans</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {parsed.map((q, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-muted">{i + 1}</td>
                        <td className="px-3 py-2 text-ink">{q.question}</td>
                        <td className="px-3 py-2 text-muted">{q.option_a}</td>
                        <td className="px-3 py-2 text-muted">{q.option_b}</td>
                        <td className="px-3 py-2 text-muted">{q.option_c}</td>
                        <td className="px-3 py-2 text-muted">{q.option_d}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50 text-primary font-bold">
                            {q.correct}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={save} disabled={saving} className="btn btn-primary">
                  {saving ? "Saving…" : `Save ${parsed.length} questions`}
                </button>
                <button
                  onClick={() => {
                    setParsed(null);
                    setProblems([]);
                  }}
                  className="text-sm font-medium text-muted hover:text-ink transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
