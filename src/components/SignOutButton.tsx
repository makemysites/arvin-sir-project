"use client";

import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/signout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      className="text-sm font-medium text-muted hover:text-ink transition-colors"
    >
      Sign out
    </button>
  );
}
