import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { cn } from "@/components/ui/cn";

const linkButtonClassName =
  "inline-flex min-h-11 w-full items-center justify-center rounded-2xl px-5 py-3 text-base font-medium transition-all duration-200 ease-out";

export default function HouseholdInviteNotFound() {
  return (
    <AuthShell
      title="Invite not found"
      subtitle="This household invite is invalid, expired, or has already been used."
    >
      <div className="space-y-4">
        <p className="text-sm leading-6 text-white/55">
          Ask the household owner to send a new invite from Settings.
        </p>
        <Link
          href="/login"
          className={cn(
            linkButtonClassName,
            "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]",
          )}
        >
          Go to sign in
        </Link>
        <p className="text-center text-sm text-white/40">
          <Link href="/" className="text-[var(--accent)] hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
