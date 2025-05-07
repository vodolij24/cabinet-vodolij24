import { format } from "date-fns";

import prismadb from "@/lib/prismadb";

import { DailyStatColumn } from "./components/columns"
import { SizesClient } from "./components/client";

const SizesPage = async ({
}: {
}) => {
  const daily_statistics = await prismadb.daily_statistics.findMany({
    where: {
    },
    orderBy: {
      id: 'desc'
    }
  });

  const formattedStatistic: DailyStatColumn[] = daily_statistics.map((item) => ({
    id: item.id,
    date: item.date,
    totalWater: item.totalWater,
    totalTransactions: item.totalTransactions,
    uniqueUsers: item.uniqueUsers,
    topUserId: item.topUserId,
    topUserVolume: item.topUserVolume,
    topDeviceId: item.topDeviceId,
    topDeviceTransactions: item.topDeviceTransactions
  }));

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <SizesClient data={formattedStatistic} />
      </div>
    </div>
  );
};

export default SizesPage;
