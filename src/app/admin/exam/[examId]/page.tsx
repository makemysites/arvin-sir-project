import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import Header from "@/components/Header";
import QuestionUpload from "@/components/admin/QuestionUpload";
import StatusControls from "@/components/admin/StatusControls";
import DownloadCsvButton from "@/components/admin/DownloadCsvButton";
import type { ExamStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  live: "bg-emerald-100 text-emerald-700",
  ended: "bg-slate-800 text-white",
};

export default async function AdminExamPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/");

  const { examId } = await params;
  if (!ObjectId.isValid(examId)) notFound();
  const examOid = new ObjectId(examId);

  const db = await getDb();
  const [exam, questionCount, attempts] = await Promise.all([
    db.collection("exams").findOne({ _id: examOid }),
    db.collection("questions").countDocuments({ exam_id: examOid }),
    db
      .collection("attempts")
      .find({ exam_id: examOid })
      .sort({ score: -1 })
      .toArray(),
  ]);

  if (!exam) notFound();

  const studentIds = attempts.map((a) => a.student_id);
  const students = studentIds.length
    ? await db.collection("users").find({ _id: { $in: studentIds } }).toArray()
    : [];
  const studentById = new Map(students.map((s) => [s._id.toString(), s]));

  const submitted = attempts.filter((r) => r.status === "submitted");
  const inProgress = attempts.filter((r) => r.status === "in_progress");

  const csvRows = submitted.map((r) => {
    const s = studentById.get(r.student_id.toString());
    return {
      name: s?.full_name ?? "",
      email: s?.email ?? "",
      score: r.score as number | null,
      total: r.total as number | null,
      violations: r.violations as number,
      autoSubmitted: Boolean(r.auto_submitted),
      submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : null,
    };
  });

  return (
    <>
      <Header name={admin.email} isAdmin />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/admin" className="text-sm text-indigo-600 hover:underline">
              ← All exams
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              {exam.title}
              <span
                className={`ml-3 align-middle text-xs font-semibold uppercase px-2.5 py-1 rounded-full ${STATUS_STYLES[exam.status]}`}
              >
                {exam.status}
              </span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {exam.duration_minutes} minutes · {questionCount} questions
            </p>
          </div>
          <StatusControls
            examId={examId}
            status={exam.status as ExamStatus}
            questionCount={questionCount}
          />
        </div>

        {exam.status === "draft" && (
          <QuestionUpload examId={examId} existingCount={questionCount} />
        )}

        <section className="bg-white border border-slate-200 rounded-xl">
          <div className="p-4 flex items-center justify-between flex-wrap gap-2 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">
              Results
              <span className="text-slate-400 font-normal ml-2 text-sm">
                {submitted.length} submitted
                {inProgress.length > 0 && ` · ${inProgress.length} writing now`}
              </span>
            </h2>
            <div className="flex gap-2">
              <Link
                href={`/leaderboard/${examId}`}
                className="text-sm rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
              >
                🏆 Leaderboard
              </Link>
              <DownloadCsvButton
                rows={csvRows}
                fileName={`${exam.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-results.csv`}
              />
            </div>
          </div>

          {attempts.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">No attempts yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 bg-slate-50">
                  <th className="px-4 py-2.5">Student</th>
                  <th className="px-4 py-2.5 text-right">Score</th>
                  <th className="px-4 py-2.5 text-center hidden sm:table-cell">Violations</th>
                  <th className="px-4 py-2.5 text-right hidden md:table-cell">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attempts.map((r) => {
                  const s = studentById.get(r.student_id.toString());
                  return (
                    <tr key={r._id.toString()}>
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-slate-900">
                          {s?.full_name ?? "—"}
                        </span>
                        <span className="text-slate-400 block text-xs">{s?.email}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold">
                        {r.status === "submitted" ? (
                          <>
                            {r.score}
                            <span className="text-slate-400 font-normal">/{r.total}</span>
                          </>
                        ) : (
                          <span className="text-emerald-600 text-xs font-medium">writing…</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center hidden sm:table-cell">
                        {r.violations > 0 ? (
                          <span className="text-amber-600 font-medium">⚠ {r.violations}</span>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-slate-500 hidden md:table-cell">
                        {r.status === "submitted"
                          ? r.auto_submitted
                            ? "Auto-submitted"
                            : "Submitted"
                          : "In progress"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {r.status === "submitted" && (
                          <Link
                            href={`/results/${r._id.toString()}`}
                            className="text-xs text-indigo-600 hover:underline"
                          >
                            View answers
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </>
  );
}
