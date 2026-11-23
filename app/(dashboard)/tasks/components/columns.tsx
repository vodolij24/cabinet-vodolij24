"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/table-core";
import {
  Banknote,
  Calendar,
  User,
  Wallet,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { CellAction } from "./cell-action";
import { TaskStatusSelect } from "./task-status-select";

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
        <Link
          href={`/tasks/${row.original.id}`}
          className="font-medium leading-snug hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {row.original.title}
        </Link>
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
      <TaskStatusSelect
        taskId={row.original.id}
        status={row.original.statusKey}
        className="h-8 w-[220px]"
      />
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => <CellAction data={row.original} />,
  },
];
