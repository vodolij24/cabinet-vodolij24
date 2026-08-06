"use client";

import { ColumnDef } from "@tanstack/table-core";
import {
  Banknote,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  User,
  Wallet,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isManagerReviewableStatus } from "@/lib/task-fields";

import { CellAction } from "./cell-action";

export type TaskColumn = {
  id: number;
  title: string;
  type: string;
  typeKey: string;
  baseLocation: string;
  dueAt: string;
  dueAtSort: number | null;
  overdue: boolean;
  salaryDeduction: string;
  salaryDeductionValue: number | null;
  schedule: string;
  deviceId: number | null;
  description: string | null;
  status: string | null;
  statusKey: string;
  workerId: string | null | undefined;
  workerName: string;
  createdAt: string | null;
  updatedAt: string;
};

function TypeBadge({ typeKey, label }: { typeKey: string; label: string }) {
  if (typeKey === "financial") {
    return (
      <Badge variant="secondary" className="gap-1 font-normal">
        <Wallet className="h-3 w-3" />
        {label}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="gap-1 border-sky-200 bg-sky-50 text-sky-800 font-normal dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200"
    >
      <Wrench className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function StatusBadge({
  statusKey,
  label,
}: {
  statusKey: string;
  label: string | null;
}) {
  const text = label || "—";

  if (statusKey === "done") {
    return (
      <Badge className="gap-1 bg-emerald-600 font-normal hover:bg-emerald-600">
        <CheckCircle2 className="h-3 w-3" />
        {text}
      </Badge>
    );
  }

  if (isManagerReviewableStatus(statusKey)) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-amber-300 bg-amber-50 text-amber-900 font-normal dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
      >
        <Clock className="h-3 w-3" />
        {text}
      </Badge>
    );
  }

  if (statusKey === "in_progress") {
    return (
      <Badge variant="secondary" className="gap-1 font-normal">
        <Clock className="h-3 w-3" />
        {text}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1 font-normal">
      <Circle className="h-3 w-3" />
      {text}
    </Badge>
  );
}

export const columns: ColumnDef<TaskColumn>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">{row.original.id}</span>
    ),
  },
  {
    accessorKey: "type",
    header: "Тип",
    cell: ({ row }) => (
      <TypeBadge typeKey={row.original.typeKey} label={row.original.type} />
    ),
  },
  {
    accessorKey: "title",
    header: "Назва",
    cell: ({ row }) => (
      <div className="min-w-[160px] max-w-[260px]">
        <p className="font-medium leading-snug">{row.original.title}</p>
        {row.original.baseLocation && row.original.baseLocation !== "—" ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {row.original.baseLocation}
          </p>
        ) : null}
      </div>
    ),
  },
  {
    accessorKey: "dueAt",
    header: "Термін",
    cell: ({ row }) => (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-sm",
          row.original.overdue && "font-medium text-destructive"
        )}
      >
        <Calendar className="h-3.5 w-3.5 shrink-0 opacity-70" />
        {row.original.dueAt}
      </span>
    ),
  },
  {
    accessorKey: "salaryDeduction",
    header: "Утримання",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1.5 text-sm tabular-nums">
        {row.original.salaryDeductionValue != null ? (
          <Banknote className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : null}
        {row.original.salaryDeduction}
      </span>
    ),
  },
  {
    accessorKey: "workerName",
    header: "Виконавець",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1.5 text-sm">
        <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        {row.original.workerName || "—"}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Статус",
    cell: ({ row }) => (
      <StatusBadge
        statusKey={row.original.statusKey}
        label={row.original.status}
      />
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => <CellAction data={row.original} />,
  },
];
