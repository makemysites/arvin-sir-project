"use client";

import { useCallback, useEffect, useState } from "react";

interface AdminEntry {
  email: string;
  source: "env" | "database";
  isSuperAdmin: boolean;
  addedBy?: string;
  createdAt?: string;
}

export default function AdminManager({
  currentUserEmail,
}: {
  currentUserEmail: string;
}) {
  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchAdmins = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/admins");
      const body = await res.json();
      if (res.ok) setAdmins(body.admins ?? []);
    } catch {
      // silently fail — we'll show the list as empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setAdding(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not add admin.");
        return;
      }
      setSuccess(`${email.trim()} is now an admin.`);
      setEmail("");
      fetchAdmins();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(targetEmail: string) {
    if (!confirm(`Remove ${targetEmail} as admin?`)) return;
    setRemoving(targetEmail);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not remove admin.");
        return;
      }
      setSuccess(`${targetEmail} has been removed.`);
      fetchAdmins();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="card overflow-hidden">
      {/* Add admin form */}
      <div className="p-5 border-b border-line">
        <form onSubmit={handleAdd} className="flex gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email to make admin…"
            className="field flex-1 text-sm"
          />
          <button
            type="submit"
            disabled={adding}
            className="btn btn-primary shrink-0"
          >
            {adding ? "Adding…" : "Add Admin"}
          </button>
        </form>
        {error && (
          <p className="flex items-start gap-2 text-sm text-danger bg-red-50 border border-red-100 rounded-xl p-3 mt-3">
            <span aria-hidden>⚠</span> {error}
          </p>
        )}
        {success && (
          <p className="flex items-start gap-2 text-sm text-success bg-emerald-50 border border-emerald-100 rounded-xl p-3 mt-3">
            <span aria-hidden>✓</span> {success}
          </p>
        )}
      </div>

      {/* Admin list */}
      {loading ? (
        <div className="p-8 text-center text-sm text-muted">Loading admins…</div>
      ) : admins.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted">
          No admins found.
        </div>
      ) : (
        <div className="divide-y divide-line">
          {admins.map((admin) => {
            const isCurrentUser =
              admin.email.toLowerCase() === currentUserEmail.toLowerCase();
            const canRemove =
              admin.source === "database" && !admin.isSuperAdmin;

            return (
              <div
                key={admin.email}
                className="px-5 py-4 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 text-primary text-sm font-bold flex items-center justify-center">
                    {admin.email.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-ink text-sm truncate">
                        {admin.email}
                      </span>
                      {admin.isSuperAdmin && (
                        <span className="pill bg-amber-50 text-amber-700">
                          ⭐ Super Admin
                        </span>
                      )}
                      {isCurrentUser && !admin.isSuperAdmin && (
                        <span className="pill bg-indigo-50 text-primary">You</span>
                      )}
                      {admin.source === "env" && !admin.isSuperAdmin && (
                        <span className="pill bg-slate-100 text-muted">Admin</span>
                      )}
                    </div>
                    {admin.addedBy && (
                      <p className="text-xs text-muted mt-0.5">
                        Added by {admin.addedBy}
                        {admin.createdAt &&
                          ` · ${new Date(admin.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}`}
                      </p>
                    )}
                  </div>
                </div>
                {canRemove && (
                  <button
                    onClick={() => handleRemove(admin.email)}
                    disabled={removing === admin.email}
                    className="btn btn-sm btn-danger shrink-0"
                  >
                    {removing === admin.email ? "Removing…" : "Remove"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
