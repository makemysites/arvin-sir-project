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
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-slate-900">Questions</h3>
          <p className="text-sm text-slate-500">
            {existingCount > 0
              ? `${existingCount} question${existingCount > 1 ? "s" : ""} uploaded. Uploading a new file replaces them.`
              : "Upload an Excel sheet: question | option A | option B | option C | option D | correct (A/B/C/D)"}
          </p>
        </div>
        <label className="cursor-pointer rounded-lg border border-indigo-600 text-indigo-600 font-medium py-2 px-4 hover:bg-indigo-50">
          Choose Excel file
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onFile}
            className="hidden"
          />
        </label>
      </div>

      {problems.length > 0 && (
        <div className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
          <p className="font-medium mb-1">Some rows were skipped:</p>
          <ul className="list-disc pl-5">
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
            <p className="text-sm text-red-600">
              No valid questions found in {fileName}. Check the column order.
            </p>
          ) : (
            <>
              <div className="border border-slate-200 rounded-lg overflow-auto max-h-72">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="text-left text-slate-500">
                      <th className="px-2 py-2 w-8">#</th>
                      <th className="px-2 py-2">Question</th>
                      <th className="px-2 py-2">A</th>
                      <th className="px-2 py-2">B</th>
                      <th className="px-2 py-2">C</th>
                      <th className="px-2 py-2">D</th>
                      <th className="px-2 py-2 w-14">Correct</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsed.map((q, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1.5 text-slate-400">{i + 1}</td>
                        <td className="px-2 py-1.5">{q.question}</td>
                        <td className="px-2 py-1.5">{q.option_a}</td>
                        <td className="px-2 py-1.5">{q.option_b}</td>
                        <td className="px-2 py-1.5">{q.option_c}</td>
                        <td className="px-2 py-1.5">{q.option_d}</td>
                        <td className="px-2 py-1.5 font-semibold text-center">{q.correct}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={save}
                  disabled={saving}
                  className="rounded-lg bg-indigo-600 text-white font-medium py-2 px-5 hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? "Saving…" : `Save ${parsed.length} questions`}
                </button>
                <button
                  onClick={() => {
                    setParsed(null);
                    setProblems([]);
                  }}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
