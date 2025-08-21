import prismadb from "@/lib/prismadb";

interface GraphData {
  name: string;
  total: number;
}

export const getGraphRevenue = async (): Promise<GraphData[]> => {
  const stats = await prismadb.daily_statistics.findMany();
  const monthlyRevenue: { [key: number]: number } = {};

  for (const stat of stats) {
    if (!stat.createdAt) continue;
    const month = stat.createdAt.getMonth();
    monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (stat.totalRevenue || 0);
  }

  // Convert to GraphData[]
  return Object.entries(monthlyRevenue).map(([month, total]) => ({
    name: new Date(2025, Number(month)).toLocaleString('default', { month: 'short' }),
    total,
  }));
};
