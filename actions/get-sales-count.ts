import prismadb from "@/lib/prismadb";

export const getSalesCount = async (storeId: string) => {
  const salesCount = await prismadb.daily_statistics.count({
    where: {
    },
  });

  return salesCount;
};
