type PageIntroProps = {
  subtitle?: string;
};

export function PageIntro({ subtitle }: PageIntroProps) {
  if (!subtitle) {
    return null;
  }

  return (
    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)] sm:text-base">
      {subtitle}
    </p>
  );
}
