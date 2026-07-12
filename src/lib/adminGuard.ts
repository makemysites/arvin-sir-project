import { getUser, checkIsAdmin, type SessionUser } from "@/lib/auth";

// Returns the user if they are the admin, otherwise null.
export async function requireAdmin(): Promise<SessionUser | null> {
  const user = await getUser();
  if (!user || !(await checkIsAdmin(user.email))) return null;
  return user;
}
