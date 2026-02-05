"use client";

import { ColumnDef } from "@tanstack/table-core";

import { CellAction } from "./cell-action";

export type BotTrransactionsColumn = {
  id: number;
  date: Date;
  cardId: number | null;
  device: number;
  waterRequested: number | null;
  waterFullfiled: number | null;
  cashAmount: number | null;
  personalCardAmount: number | null;
  creditCardAmount: number | null;
  transactionChange: number | null;
};

export const columns: ColumnDef<BotTrransactionsColumn>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },
  {
    accessorKey: "date",
    header: "Дата",
  },
  {
    accessorKey: "cardId",
    header: "Карта",
  },
  {
    accessorKey: "device",
    header: "Апарат",
  },
  {
    accessorKey: "waterRequested",
    header: "Замовлено",
  },
  {
    accessorKey: "waterFullfiled",
    header: "Налито",
  },
  {
    accessorKey: "cashAmount",
    header: "Готівка",
  },
  {
    accessorKey: "personalCardAmount",
    header: "Баланс",
  },
  {
    accessorKey: "creditCardAmount",
    header: "Кредитка",
  },
  {
    accessorKey: "transactionChange",
    header: "Решта",
  },
  {
    id: "actions",
    /*  cell: ({ row }) => <CellAction data={row.original} />*/
  },
];
