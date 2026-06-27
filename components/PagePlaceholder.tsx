import { Card } from "@/components/ui";

type PagePlaceholderProps = {
  title: string;
  subtitle: string;
};

export function PagePlaceholder({ title, subtitle }: PagePlaceholderProps) {
  return (
    <Card padding="lg">
      <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/45 sm:text-base">
        {subtitle}
      </p>
    </Card>
  );
}
