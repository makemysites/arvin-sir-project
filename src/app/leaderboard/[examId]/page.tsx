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

  // Students can always see ended-exam leaderboards. During a live exam they
  // can watch the standings too — but only after submitting their own attempt.
  if (!admin && exam.status !== "ended") {
    if (exam.status !== "live") redirect("/dashboard");
    const myAttempt = await db.collection("attempts").findOne({
      exam_id: examOid,
      student_id: new ObjectId(user.id),
      status: "submitted",
    });
    if (!myAttempt) redirect("/dashboard");
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
  const students = studentIds.length
    ? await db.collection("users").find({ _id: { $in: studentIds } }).toArray()
    : [];
  const studentById = new Map(students.map((s) => [s._id.toString(), s]));

  // Rank by score; tie-break equal scores by who finished faster.
  const ranked = attempts.sort((a, b) => {
    if ((b.score ?? 0) !== (a.score ?? 0)) return (b.score ?? 0) - (a.score ?? 0);
    const ta = new Date(a.submitted_at ?? 0).getTime() - new Date(a.started_at).getTime();
    const tb = new Date(b.submitted_at ?? 0).getTime() - new Date(b.started_at).getTime();
    return ta - tb;
  });

  const nameOf = (row: (typeof ranked)[number]) => {
    const s = studentById.get(row.student_id.toString());
    return s?.full_name ?? s?.email ?? "Student";
  };
  const minsOf = (row: (typeof ranked)[number]) =>
    row.submitted_at
      ? Math.round(
          (new Date(row.submitted_at).getTime() - new Date(row.started_at).getTime()) / 60000
        )
      : null;

  const podium = ranked.slice(0, 3);
  // Visual order: 2nd, 1st, 3rd
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean);
  const podiumMeta = new Map(
    podium.map((row, i) => [
      row._id.toString(),
      [
        { medal: "🥇", height: "h-28", ring: "from-amber-400 to-yellow-500" },
        { medal: "🥈", height: "h-20", ring: "from-slate-300 to-slate-400" },
        { medal: "🥉", height: "h-16", ring: "from-orange-300 to-amber-600" },
      ][i],
    ])
  );

  return (
    <>
      <Header name={viewer?.full_name ?? user.email} isAdmin={admin} />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10">
        <div className="text-center mb-10 fade-up">
          <p className="pill bg-indigo-50 text-primary mb-2">{exam.title}</p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
            Leaderboard
          </h1>
          {exam.status === "live" && (
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-4 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Live standings — refresh to see new submissions
            </p>
          )}
        </div>

        {ranked.length === 0 ? (
          <div className="card p-10 text-center fade-up">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-50 border border-line flex items-center justify-center text-2xl mb-4">
              🏆
            </div>
            <p className="font-semibold text-ink">No submissions yet</p>
            <p className="text-sm text-muted mt-1">Scores will appear here as students finish.</p>
          </div>
        ) : (
          <>
            {/* Podium */}
            {podium.length > 1 && (
              <div className="flex items-end justify-center gap-4 mb-10 fade-up">
                {podiumOrder.map((row) => {
                  const meta = podiumMeta.get(row._id.toString())!;
                  const isMe = row.student_id.toString() === user.id;
                  return (
                    <div key={row._id.toString()} className="flex flex-col items-center w-32">
                      <span className="text-3xl mb-2">{meta.medal}</span>
                      <p
                        className={`text-sm font-semibold text-center leading-tight truncate w-full ${
                          isMe ? "text-primary" : "text-ink"
                        }`}
                        title={nameOf(row)}
                      >
                        {nameOf(row)}
                      </p>
                      <p className="text-xs text-muted mb-2">
                        {row.score}/{row.total}
                      </p>
                      <div
                        className={`w-full ${meta.height} rounded-t-2xl bg-gradient-to-b ${meta.ring} opacity-85`}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <div className="card overflow-hidden fade-up">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 text-muted text-left text-xs uppercase tracking-wider">
                    <th className="px-5 py-3.5 w-16 font-semibold">Rank</th>
                    <th className="px-5 py-3.5 font-semibold">Student</th>
                    <th className="px-5 py-3.5 text-right font-semibold">Score</th>
                    <th className="px-5 py-3.5 text-right hidden sm:table-cell font-semibold">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {ranked.map((row, i) => {
                    const isMe = row.student_id.toString() === user.id;
                    const mins = minsOf(row);
                    return (
                      <tr key={row._id.toString()} className={isMe ? "bg-indigo-50/50" : undefined}>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                              i === 0
                                ? "bg-amber-100 text-amber-700"
                                : i === 1
                                  ? "bg-slate-100 text-slate-600"
                                  : i === 2
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-slate-50 text-muted"
                            }`}
                          >
                            {i + 1}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-semibold text-ink">{nameOf(row)}</span>
                          {isMe && (
                            <span className="pill bg-indigo-50 text-primary ml-2">You</span>
                          )}
                          {admin && row.violations > 0 && (
                            <span className="text-xs text-amber-600 font-medium ml-2">
                              ⚠ {row.violations}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="font-display font-bold text-ink">{row.score}</span>
                          <span className="text-muted">/{row.total}</span>
                        </td>
                        <td className="px-5 py-3.5 text-right text-muted hidden sm:table-cell">
                          {mins !== null ? `${mins} min` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="text-center mt-10">
          <Link href={admin ? `/admin/exam/${examId}` : "/dashboard"} className="btn btn-outline">
            ← Back
          </Link>
        </div>
      </main>
    </>
  );
}
