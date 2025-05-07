"use client"

import { ColumnDef } from '@tanstack/table-core';

import { CellAction } from "./cell-action"

export type DailyStatColumn = {
  id: number;
  date: string;
  totalWater: number;
  totalTransactions: number;
  uniqueUsers: number;
  topUserId: number | null;
  topUserVolume: number | null;
  topDeviceId: number | null;
  topDeviceTransactions: number | null;  
}

export const columns: ColumnDef<DailyStatColumn>[] = [
  {
    accessorKey: "date",
    header: "Дата",
  },
  {
    accessorKey: "totalWater",
    header: "Налито",
  },
  {
    accessorKey: "totalTransactions",
    header: "Транзакції",
  },
  {
    accessorKey: "uniqueUsers",
    header: "Користувачі",
  },
  {
    accessorKey: "topUserId",
    header: "Топ Карта",
  },
  {
    accessorKey: "topUserVolume",
    header: "Обє’м лідера",
  },
  {
    accessorKey: "topDeviceId",
    header: "Топ Апарат",
  },
  {
    accessorKey: "topDeviceTransactions",
    header: "Наливи Топ Апарату",
  },
  {
    id: "actions",
  /*  cell: ({ row }) => <CellAction data={row.original} />*/
  },
];
