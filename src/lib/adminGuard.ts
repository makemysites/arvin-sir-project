import { getUser, isAdminEmail, type SessionUser } from "@/lib/auth";

// Returns the user if they are the admin, otherwise null.
export async function requireAdmin(): Promise<SessionUser | null> {
  const user = await getUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}
