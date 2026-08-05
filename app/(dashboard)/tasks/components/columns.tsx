"use client";

import { ColumnDef } from "@tanstack/table-core";

import { CellAction } from "./cell-action";

export type TaskColumn = {
  id: number;
  title: string;
  type: string;
  baseLocation: string;
  dueAt: string;
  salaryDeduction: string;
  schedule: string;
  deviceId: number | null;
  description: string | null;
  status: string | null;
  workerId: string | null | undefined;
  createdAt: string | null;
  updatedAt: string;
};

export const columns: ColumnDef<TaskColumn>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },
  {
    accessorKey: "type",
    header: "Тип",
  },
  {
    accessorKey: "title",
    header: "Назва",
  },
  {
    accessorKey: "baseLocation",
    header: "База",
  },
  {
    accessorKey: "dueAt",
    header: "Термін",
  },
  {
    accessorKey: "salaryDeduction",
    header: "Утримання із заробітної плати",
  },
  {
    accessorKey: "workerId",
    header: "Виконавець",
  },
  {
    accessorKey: "status",
    header: "Статус",
  },
  {
    accessorKey: "deviceId",
    header: "Апарат",
  },
  {
    id: "actions",
    cell: ({ row }) => <CellAction data={row.original} />,
  },
];
