import Link from "next/link";
import SignOutButton from "./SignOutButton";

export default function Header({
  name,
  isAdmin = false,
}: {
  name: string;
  isAdmin?: boolean;
}) {
  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link
          href={isAdmin ? "/admin" : "/dashboard"}
          className="font-bold text-slate-900"
        >
          Aptitude Exam Portal
          {isAdmin && (
            <span className="ml-2 text-xs font-semibold text-white bg-indigo-600 rounded-full px-2 py-0.5 align-middle">
              ADMIN
            </span>
          )}
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600 hidden sm:inline">{name}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
