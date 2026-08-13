import { Badge } from "@/components/ui/badge";
import type { HandoverAlert, RecountAlert } from "@/lib/collection-alert";

const STYLES: Record<
  NonNullable<RecountAlert> | "progress",
  { label: string; className: string }
> = {
  alarm: {
    label: "Тривога",
    className: "border-transparent bg-red-600 text-white dark:bg-red-600",
  },
  warning: {
    label: "Увага",
    className: "border-transparent bg-amber-500 text-white dark:bg-amber-500",
  },
  success: {
    label: "Успіх",
    className:
      "border-transparent bg-emerald-600 text-white dark:bg-emerald-600",
  },
  pending: {
    label: "Очікує",
    className:
      "border-transparent bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  },
  progress: {
    label: "В процесі",
    className:
      "border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200",
  },
};

export function CollectionStatusBadge({
  alert,
}: {
  alert: RecountAlert | HandoverAlert | null;
}) {
  if (!alert) {
    return <span className="text-muted-foreground">—</span>;
  }
  const style = STYLES[alert];
  return <Badge className={style.className}>{style.label}</Badge>;
}
