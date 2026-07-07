import Link from "next/link";
import Logo from "./Logo";
import SignOutButton from "./SignOutButton";

export default function Header({
  name,
  isAdmin = false,
}: {
  name: string;
  isAdmin?: boolean;
}) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/75 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link
          href={isAdmin ? "/admin" : "/dashboard"}
          className="flex items-center gap-2.5"
        >
          <Logo className="h-8 w-8" />
          <span className="font-display font-bold tracking-tight text-ink">
            Aptitude<span className="text-primary">·</span>Portal
          </span>
          {isAdmin && (
            <span className="pill bg-ink text-white ml-1">Admin</span>
          )}
        </Link>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2.5">
            <span className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-sm font-bold flex items-center justify-center">
              {initial}
            </span>
            <span className="text-sm font-medium text-ink max-w-40 truncate">{name}</span>
          </div>
          <span className="hidden sm:block h-5 w-px bg-line" />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
