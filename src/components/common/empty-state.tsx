import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  return (
    <section className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border-strong)] bg-white px-6 py-12 text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--bg-muted)] text-[var(--text-secondary)]">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="text-base font-semibold text-[var(--text-primary)]">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
        {description}
      </p>
    </section>
  );
}
