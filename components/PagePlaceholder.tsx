import { Card } from "@/components/ui";

type PagePlaceholderProps = {
  title: string;
  subtitle: string;
};

export function PagePlaceholder({ title, subtitle }: PagePlaceholderProps) {
  return (
    <Card padding="lg">
      <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)] sm:text-base">
        {subtitle}
      </p>
    </Card>
  );
}
