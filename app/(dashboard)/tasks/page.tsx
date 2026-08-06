import prismadb from "@/lib/prismadb";
import {
  taskScheduleLabel,
  taskStatusLabel,
  taskTypeLabel,
} from "@/lib/task-fields";

import { TaskColumn } from "./components/columns";
import { TasksClient } from "./components/client";

const TasksPage = async () => {
  const tasks = await prismadb.tasks.findMany({
    where: {},
    orderBy: {
      createdAt: "desc",
    },
  });

  const workers = await prismadb.workers.findMany({
    where: {},
  });

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const formattedTask: TaskColumn[] = tasks.map((item) => {
    const statusKey = item.status || "todo";
    const workerName = item.workerId
      ? workers.find((worker) => worker.id == item.workerId)?.name || ""
      : "";

    return {
      id: item.id,
      title: item.title,
      type: taskTypeLabel(item.type),
      typeKey: item.type || "operational",
      baseLocation: item.baseLocation || "—",
      dueAt: item.dueAt ? item.dueAt.toLocaleDateString("uk-UA") : "—",
      dueAtSort: item.dueAt ? item.dueAt.getTime() : null,
      overdue: Boolean(
        item.dueAt &&
          item.dueAt < startOfToday &&
          statusKey !== "done"
      ),
      salaryDeduction:
        item.salaryDeduction != null
          ? `${item.salaryDeduction.toLocaleString("uk-UA")} грн`
          : "—",
      salaryDeductionValue: item.salaryDeduction,
      schedule: taskScheduleLabel(item.schedule),
      deviceId: item.deviceId,
      description: item.description,
      status: taskStatusLabel(item.status),
      statusKey,
      workerId: item.workerId
        ? workers.find((worker) => worker.id == item.workerId)?.name
        : "",
      workerName,
      createdAt: item.createdAt.toLocaleString(),
      updatedAt: item.updatedAt.toLocaleString(),
    };
  });

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <TasksClient data={formattedTask} />
      </div>
    </div>
  );
};

export default TasksPage;
