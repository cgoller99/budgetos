import Link from "next/link";

export function AuthLegalLinks() {
  return (
    <p className="mt-6 text-center text-xs leading-relaxed text-white/35">
      By continuing, you agree to our{" "}
      <Link href="/terms" className="text-[var(--accent)] hover:underline">
        Terms of Service
      </Link>{" "}
      and{" "}
      <Link href="/privacy" className="text-[var(--accent)] hover:underline">
        Privacy Policy
      </Link>
      .
    </p>
  );
}
