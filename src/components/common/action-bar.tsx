import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function TableActionBar({
  count,
  children,
  className,
}: {
  count: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("tf-card flex flex-col gap-3 border-[var(--brand-primary)] bg-blue-50/60 p-3 md:flex-row md:items-center md:justify-between", className)}>
      <span className="text-sm font-semibold text-[var(--brand-primary)]">{count}개 선택됨</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

export function TableEmptyRow({ message }: { message: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center px-6 py-10 text-sm text-[var(--text-secondary)]">
      {message}
    </div>
  );
}

