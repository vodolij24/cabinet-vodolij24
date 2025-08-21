await prismadb.workers.create({
  data: {
    chat_id: 123456789, // Replace with the actual chat_id value
    name: "John Doe",
    // Add other required fields here, e.g.:
    // active: true
  }
});

// import prisma from "@/lib/prisma"; // Removed because prismadb is used instead

// await prismadb.workers.create({
//   data: {
//     name: "John Doe",
//     // ...other fields...
//     // active: true, // optional, will default to false if not set
//   }
// });

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
