import prismadb from "@/lib/prismadb";

export const getTotalRevenue = async (storeId: string) => {
  const paidOrders = await prismadb.daily_statistics.findMany({
    where: {
    },
  });

  const totalRevenue = 0

  return totalRevenue;
};
