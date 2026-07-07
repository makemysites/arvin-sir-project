import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { getUser, isAdminEmail } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (isAdminEmail(user.email)) redirect("/admin");

  const db = await getDb();
  const profile = await db
    .collection("users")
    .findOne({ _id: new ObjectId(user.id) }, { projection: { full_name: 1 } });

  if (!profile?.full_name) redirect("/setup");
  redirect("/dashboard");
}
