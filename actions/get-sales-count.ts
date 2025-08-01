import prismadb from "@/lib/prismadb";
import { startOfMonth, endOfMonth } from 'date-fns';

const now = new Date();
const start = startOfMonth(now);
const end = endOfMonth(now);

export const getSalesCount = async () => {
  const todoTasksCount = await prismadb.tasks.count({
    where: {
      status: 'todo',
      createdAt: {
        gte: start,
        lte: end,
      },
    },
  });

  return todoTasksCount;
};
