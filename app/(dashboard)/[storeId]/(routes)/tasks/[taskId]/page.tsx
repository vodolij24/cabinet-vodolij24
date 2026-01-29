import prismadb from "@/lib/prismadb";
import { DriversForm } from "./components/driver-form";

const SizePage = async ({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) => {
  const { taskId } = await params;
  const taskNumber = taskId === "new" ? 0 : Number(taskId);

  const tasks = await prismadb.tasks.findUnique({
    where: {
      id: taskNumber,
    },
  });

  const workers = await prismadb.workers.findMany({
    where: {
      active: true,
    },
  });

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <DriversForm initialData={tasks} workers={workers} />
      </div>
    </div>
  );
};

export default SizePage;
