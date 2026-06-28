import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#090b10] px-6 py-16 font-sans text-white">
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-10 text-center">
          <Link href="/" className="inline-flex flex-col items-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-3xl border border-white/[0.04] bg-white/[0.02] text-2xl">
              💰
            </span>
            <span className="mt-5 text-xl font-semibold tracking-tight text-white">
              Buxme
            </span>
          </Link>
        </div>

        <div className="onboarding-step-enter rounded-3xl border border-white/[0.04] bg-white/[0.02] p-8 sm:p-10">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {title}
            </h1>
            <p className="mt-3 text-base text-white/38">{subtitle}</p>
          </div>

          {children}
        </div>

        <div className="mt-8 text-center text-base text-white/38">{footer}</div>
      </div>
    </div>
  );
}
