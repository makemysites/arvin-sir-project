import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { getUser, isAdminEmail } from "@/lib/auth";
import { getDb } from "@/lib/db";
import Header from "@/components/Header";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  if (!ObjectId.isValid(examId)) notFound();

  const user = await getUser();
  if (!user) redirect("/login");
  const admin = isAdminEmail(user.email);

  const db = await getDb();
  const examOid = new ObjectId(examId);
  const exam = await db.collection("exams").findOne({ _id: examOid });
  if (!exam) notFound();

  // Students only see the leaderboard after the exam has ended.
  if (!admin && exam.status !== "ended") {
    redirect("/dashboard");
  }

  const [attempts, viewer] = await Promise.all([
    db
      .collection("attempts")
      .find({ exam_id: examOid, status: "submitted" })
      .toArray(),
    db.collection("users").findOne({ _id: new ObjectId(user.id) }),
  ]);

  // Attach student names.
  const studentIds = attempts.map((a) => a.student_id);
  const students = await db
    .collection("users")
    .find({ _id: { $in: studentIds } })
    .toArray();
  const studentById = new Map(students.map((s) => [s._id.toString(), s]));

  // Rank by score; tie-break equal scores by who finished faster.
  const ranked = attempts.sort((a, b) => {
    if ((b.score ?? 0) !== (a.score ?? 0)) return (b.score ?? 0) - (a.score ?? 0);
    const ta = new Date(a.submitted_at ?? 0).getTime() - new Date(a.started_at).getTime();
    const tb = new Date(b.submitted_at ?? 0).getTime() - new Date(b.started_at).getTime();
    return ta - tb;
  });

  const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`);

  return (
    <>
      <Header name={viewer?.full_name ?? user.email} isAdmin={admin} />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 text-center mb-1">Leaderboard</h1>
        <p className="text-center text-slate-500 mb-6">{exam.title}</p>

        {ranked.length === 0 ? (
          <p className="text-center text-sm text-slate-500 bg-white border border-slate-200 rounded-xl p-6">
            No submissions yet.
          </p>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-left">
                  <th className="px-4 py-3 w-16">Rank</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3 text-right">Score</th>
                  <th className="px-4 py-3 text-right hidden sm:table-cell">Time taken</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ranked.map((row, i) => {
                  const student = studentById.get(row.student_id.toString());
                  const mins = row.submitted_at
                    ? Math.round(
                        (new Date(row.submitted_at).getTime() - new Date(row.started_at).getTime()) / 60000
                      )
                    : null;
                  const isMe = row.student_id.toString() === user.id;
                  return (
                    <tr key={row._id.toString()} className={isMe ? "bg-indigo-50/60" : undefined}>
                      <td className="px-4 py-3 font-semibold">{medal(i)}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900">
                          {student?.full_name ?? student?.email ?? "Student"}
                        </span>
                        {isMe && <span className="text-xs text-indigo-600 ml-2">(you)</span>}
                        {admin && row.violations > 0 && (
                          <span className="text-xs text-amber-600 ml-2">⚠ {row.violations}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {row.score}<span className="text-slate-400 font-normal">/{row.total}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 hidden sm:table-cell">
                        {mins !== null ? `${mins} min` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-center mt-8">
          <Link
            href={admin ? `/admin/exam/${examId}` : "/dashboard"}
            className="text-sm text-indigo-600 hover:underline"
          >
            ← Back
          </Link>
        </div>
      </main>
    </>
  );
}
