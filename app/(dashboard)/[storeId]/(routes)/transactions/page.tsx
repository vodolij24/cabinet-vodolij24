import { format } from "date-fns";

import prismadb from "@/lib/prismadb";

import { BotTrransactionsColumn } from "./components/columns";
import { BotTransactions } from "./components/client";

const SizesPage = async () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 2);

  // 2. Робимо запит до БД
  const daily_statistics = await prismadb.transactions.findMany({
    where: {
      date: {
        gte: thirtyDaysAgo, // Фільтруємо: дата >= 30 днів тому
      },
    },
    orderBy: {
      date: "desc", // Зазвичай статистику краще сортувати за датою, а не за id
    },
  });

  const formattedBotTransactions: BotTrransactionsColumn[] =
    daily_statistics.map((item) => ({
      id: item.id,
      date: item.date,
      cardId: item.cardId,
      device: item.device,
      waterRequested: item.waterRequested,
      waterFullfiled: item.waterFullfilled,
      cashAmount: item.cashPaymant,
      personalCardAmount: item.cardPaymant,
      creditCardAmount: item.onlinePaymant,
      transactionChange: item.paymantChange,
    }));

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <BotTransactions data={formattedBotTransactions} />
      </div>
    </div>
  );
};

export default SizesPage;
