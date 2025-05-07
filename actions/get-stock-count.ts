import prismadb from "@/lib/prismadb";

export const getStockCount = async (storeId: string) => {
  const stockCount = await prismadb.daily_statistics.count({
    where: {
    }
  });

  return stockCount;
};
