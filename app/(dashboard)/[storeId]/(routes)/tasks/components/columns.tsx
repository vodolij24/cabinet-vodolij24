"use client"

import { ColumnDef } from '@tanstack/table-core';

import { CellAction } from "./cell-action"
import { TaskPriority, TaskStatus } from '@/lib/generated/prisma';

export type TaskColumn = {
  id: number;
  title: string;
  deviceId: number | null;
  description: string | null;
  status: string | null;
  priority: string | null;
  completedAt: Date | null;
  workerId: string | null | undefined;
  createdAt: string | null ;  
  updatedAt: string;  
}

export const columns: ColumnDef<TaskColumn>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },
  {
    accessorKey: "title",
    header: "Задача",
  },
  {
    accessorKey: "deviceId",
    header: "Апарат",
  },
  {
    accessorKey: "description",
    header: "Опис",
  },
  {
    accessorKey: "status",
    header: "Статус",
  },
  {
    accessorKey: "priority",
    header: "Пріорітет",
  },
  {
    accessorKey: "copleatedAt",
    header: "Виконано",
  },
  {
    accessorKey: "workerId",
    header: "Відповідальний",
  },
  {
    accessorKey: "createdAt",
    header: "Створено",
  },
  {
    accessorKey: "updatedAt",
    header: "Оновлено",
  },
  {
    id: "actions",
    cell: ({ row }) => <CellAction data={row.original} />
  },
];
