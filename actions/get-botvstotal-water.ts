import prismadb from "@/lib/prismadb";

interface GraphData {
  name: string;
  total: number;
  bot: number;
}

export const getBotVsTotalGraphRevenue = async (): Promise<GraphData[]> => {
  const statistics = await prismadb.daily_statistics.findMany({
    select: {
      totalWater: true,
      createdAt: true,
    },
  });

  const botStatistic = await prismadb.botAnalyticsDaylySnapshot.findMany({
    select: {
      totalWater: true,
      createdAt: true,
    },
  });

  const monthlyWater: { [key: number]: number } = {};

  const monthlyBotWater: { [key: number]: number } = {};

  // 2. Групуємо дохід по місяцях
  for (const stat of statistics) {
    const month = stat.createdAt.getMonth(); // 0 for Jan, 1 for Feb, ...

    const water = Math.round(stat.totalWater) || 0;

    // Adding the revenue for this order to the respective month
    monthlyWater[month] = (monthlyWater[month] || 0) + water;
  }

  for (const stat of botStatistic) {
    const month = stat.createdAt.getMonth();

    const water = stat.totalWater ? Math.round(stat.totalWater) : 0;

    monthlyBotWater[month] = (monthlyBotWater[month] || 0) + water;
  }

  // Converting the grouped data into the format expected by the graph
  const graphData: GraphData[] = [
    { name: "СІЧ", total: 0, bot: 0 },
    { name: "ЛЮТ", total: 0, bot: 0 },
    { name: "БЕР", total: 0, bot: 0 },
    { name: "КВІ", total: 0, bot: 0 },
    { name: "ТРА", total: 0, bot: 0 },
    { name: "ЧЕР", total: 0, bot: 0 },
    { name: "ЛИП", total: 0, bot: 0 },
    { name: "СЕР", total: 0, bot: 0 },
    { name: "ВЕР", total: 0, bot: 0 },
    { name: "ЖОВ", total: 0, bot: 0 },
    { name: "ЛИС", total: 0, bot: 0 },
    { name: "ГРУ", total: 0, bot: 0 },
  ];

  // Filling in the revenue data
  for (const month in monthlyWater) {
    graphData[parseInt(month)].total = monthlyWater[parseInt(month)];
  }

  for (const month in monthlyBotWater) {
    graphData[parseInt(month)].bot = monthlyWater[parseInt(month)];
  }

  return graphData;
};
