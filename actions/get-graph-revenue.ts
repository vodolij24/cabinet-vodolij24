import prismadb from "@/lib/prismadb";

interface GraphData {
  name: string;
  total: number;
}

export const getGraphRevenue = async (): Promise<GraphData[]> => {
  const paidOrders = await prismadb.daily_statistics.findMany({
    where: {
    },
  });

  const monthlyRevenue: { [key: number]: number } = {};

  // Grouping the orders by month and summing the revenue
  for (const order of paidOrders) {
    const month = order.createdAt.getMonth(); // 0 for Jan, 1 for Feb, ...
    let revenueForOrder = 0;
/*
    for (const item of order) {
      revenueForOrder += item.product.price.toNumber();
    }
*/
    // Adding the revenue for this order to the respective month
    monthlyRevenue[month] = (monthlyRevenue[month] || 0) + revenueForOrder;
  }

  // Converting the grouped data into the format expected by the graph
  const graphData: GraphData[] = [
    { name: "СІЧ", total: 0 },
    { name: "ЛЮТ", total: 0 },
    { name: "БЕР", total: 0 },
    { name: "КВІ", total: 0 },
    { name: "ТРА", total: 0 },
    { name: "ЧЕР", total: 0 },
    { name: "ЛИП", total: 0 },
    { name: "СЕР", total: 0 },
    { name: "ВЕР", total: 0 },
    { name: "ЖОВ", total: 0 },
    { name: "ЛИС", total: 0 },
    { name: "ГРУ", total: 0 },
  ];

  // Filling in the revenue data
  for (const month in monthlyRevenue) {
    graphData[parseInt(month)].total = monthlyRevenue[parseInt(month)];
  }

  return graphData;
};
