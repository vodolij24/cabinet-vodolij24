import prismadb from "@/lib/prismadb";

const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const yearMonth = `${year}-${month}`;

export const getTotalRevenue = async () => {
  const paidOrders = await prismadb.bot_transactions.findMany({
    where: {
      date: {
        startsWith: yearMonth,
      },
    },
    select: {
      waterFullfilled: true,
    },
  });

  console.log(paidOrders)
  
  const totalWater = paidOrders.reduce((sum, tx) => sum + (tx.waterFullfilled ?? 0), 0).toFixed(0);

  console.log(totalWater)

  return totalWater;
};
