import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import Header from "@/components/Header";
import CreateExamForm from "@/components/admin/CreateExamForm";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  live: "bg-emerald-100 text-emerald-700",
  ended: "bg-slate-800 text-white",
};

export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/");

  const db = await getDb();
  const exams = await db
    .collection("exams")
    .find({})
    .sort({ created_at: -1 })
    .toArray();

  return (
    <>
      <Header name={admin.email} isAdmin />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 space-y-8">
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-3">Create a new exam</h2>
          <CreateExamForm />
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-3">Your exams</h2>
          {exams.length === 0 ? (
            <p className="text-sm text-slate-500">No exams yet — create one above.</p>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              {exams.map((exam) => (
                <Link
                  key={exam._id.toString()}
                  href={`/admin/exam/${exam._id.toString()}`}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50"
                >
                  <div>
                    <h3 className="font-medium text-slate-900">{exam.title}</h3>
                    <p className="text-sm text-slate-500">
                      {exam.duration_minutes} min ·{" "}
                      {new Date(exam.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold uppercase px-2.5 py-1 rounded-full ${STATUS_STYLES[exam.status]}`}
                  >
                    {exam.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
