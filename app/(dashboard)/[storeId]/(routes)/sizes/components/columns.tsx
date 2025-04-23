"use client"

import { ColumnDef } from "@tanstack/react-table"

import { CellAction } from "./cell-action"

export type DriverColumn = {
  id: number;
  chat_id: bigint;
  name: string | null;
  registration_number: string | null;
  phone: string | null;
}

export const columns: ColumnDef<DriverColumn>[] = [
  {
    accessorKey: "name",
    header: "Імя",
  },
  {
    accessorKey: "chat_id",
    header: "Чат ІД",
  },
  {
    accessorKey: "registration_number",
    header: "Номер ТЗ",
  },
  {
    accessorKey: "phone",
    header: "Номер телефону",
  },
  {
    id: "actions",
    cell: ({ row }) => <CellAction data={row.original} />
  },
];
