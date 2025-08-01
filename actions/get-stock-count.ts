import prismadb from "@/lib/prismadb";
import { startOfMonth, endOfMonth } from 'date-fns';

const now = new Date();
const start = startOfMonth(now);
const end = endOfMonth(now);

export const getStockCount = async () => {
  const todoTasksCount = await prismadb.tasks.count({
    where: {
      status: 'done',
      createdAt: {
        gte: start,
        lte: end,
      },
    },
  });

  return todoTasksCount;
};
