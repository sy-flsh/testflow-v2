import { cn } from "@/lib/utils";
import { defectStatusBadgeStyles, resultStatusBadgeStyles } from "@/lib/domain/badge-maps";

const statusStyles = {
  ...resultStatusBadgeStyles,
  ...defectStatusBadgeStyles,
};

export function StatusBadge({
  status,
  label,
}: {
  status: keyof typeof statusStyles;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
        statusStyles[status],
      )}
    >
      {label}
    </span>
  );
}
