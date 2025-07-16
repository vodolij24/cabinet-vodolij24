import { format } from "date-fns";

import prismadb from "@/lib/prismadb";

import { TaskColumn } from "./components/columns"
import { SizesClient } from "./components/client";

const SizesPage = async ({
}: {
}) => {
  const daily_statistics = await prismadb.tasks.findMany({
    where: {
    },
    orderBy: {
      id: 'desc'
    }
  });

  const formattedTask: TaskColumn[] = daily_statistics.map((item) => ({
        id: item.id,
        title: item.title,
        deviceId: item.deviceId,
        description: item.description,
        status: item.status,
        priority: item.priority,
        completedAt: item.completedAt,
        workerId: item.workerId,
        createdAt: item.createdAt.toLocaleString(), 
        updatedAt: item.updatedAt.toLocaleString()
  }));

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <SizesClient data={formattedTask} />
      </div>
    </div>
  );
};

export default SizesPage;
