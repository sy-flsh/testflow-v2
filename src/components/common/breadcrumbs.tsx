import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="mb-4 flex items-center text-sm text-[var(--text-tertiary)]">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={`${item.label}-${index}`} className="flex items-center">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-[var(--text-secondary)]"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-[var(--text-secondary)]" : ""}>
                {item.label}
              </span>
            )}
            {!isLast && <ChevronRight className="mx-2 h-4 w-4" />}
          </div>
        );
      })}
    </nav>
  );
}
