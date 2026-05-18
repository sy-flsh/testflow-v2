import { cn } from "@/lib/utils";
import { priorityBadgeStyles } from "@/lib/domain/badge-maps";

export function PriorityBadge({
  priority,
  label,
}: {
  priority: keyof typeof priorityBadgeStyles;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border bg-white px-2.5 text-xs font-medium",
        priorityBadgeStyles[priority],
      )}
    >
      {label}
    </span>
  );
}
