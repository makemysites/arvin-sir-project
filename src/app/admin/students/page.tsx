import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/adminGuard";
import { isAdminEmail } from "@/lib/auth";
import { getDb } from "@/lib/db";
import Header from "@/components/Header";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/");

  const db = await getDb();
  const users = await db
    .collection("users")
    .find({})
    .sort({ created_at: -1 })
    .toArray();

  const students = users.filter((u) => !isAdminEmail(u.email));

  return (
    <>
      <Header name={admin.email} isAdmin />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10">
        <div className="fade-up mb-8">
          <Link
            href="/admin"
            className="text-sm font-medium text-muted hover:text-ink transition-colors"
          >
            ← Back to console
          </Link>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink mt-3">
            Registered students
          </h1>
          <p className="text-muted mt-1">
            {students.length} student{students.length === 1 ? "" : "s"} have created an account.
          </p>
        </div>

        {students.length === 0 ? (
          <div className="card p-10 text-center fade-up">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-2xl mb-4">
              👥
            </div>
            <p className="font-semibold text-ink">No students yet</p>
            <p className="text-sm text-muted mt-1">
              Share the site link with your class — accounts appear here as students sign up.
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden fade-up">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 text-muted text-left text-xs uppercase tracking-wider">
                  <th className="px-5 py-3.5 w-12 font-semibold">#</th>
                  <th className="px-5 py-3.5 font-semibold">Name</th>
                  <th className="px-5 py-3.5 font-semibold">Email</th>
                  <th className="px-5 py-3.5 text-right font-semibold hidden sm:table-cell">
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {students.map((s, i) => {
                  const initial = (s.full_name ?? s.email ?? "?").charAt(0).toUpperCase();
                  return (
                    <tr key={s._id.toString()} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 text-muted">{i + 1}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-xs font-bold flex items-center justify-center">
                            {initial}
                          </span>
                          <span className="font-semibold text-ink">
                            {s.full_name ?? (
                              <span className="text-muted font-normal italic">
                                Name not set yet
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted">{s.email}</td>
                      <td className="px-5 py-3.5 text-right text-muted hidden sm:table-cell">
                        {s.created_at
                          ? new Date(s.created_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
