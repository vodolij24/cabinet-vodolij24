import prismadb from "@/lib/prismadb";

import { TaskColumn } from "./components/columns";
import { TasksClient } from "./components/client";

const TasksPage = async () => {
  const tasks = await prismadb.tasks.findMany({
    where: {},
    orderBy: {
      status: "desc",
    },
  });

  const workers = await prismadb.workers.findMany({
    where: {},
  });

  const formattedTask: TaskColumn[] = tasks.map((item) => ({
    id: item.id,
    title: item.title,
    deviceId: item.deviceId,
    description: item.description,
    status: item.status,
    priority: item.priority,
    completedAt: item.completedAt,
    workerId: item.workerId
      ? workers.find((worker) => worker.id == item.workerId)?.name
      : "",
    createdAt: item.createdAt.toLocaleString(),
    updatedAt: item.updatedAt.toLocaleString(),
  }));

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <TasksClient data={formattedTask} />
      </div>
    </div>
  );
};

export default TasksPage;
