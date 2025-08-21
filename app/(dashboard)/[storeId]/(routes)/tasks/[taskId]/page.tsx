import prismadb from "@/lib/prismadb";
import { DriversForm } from "./components/driver-form";

interface SizePageProps {
  params: { taskId: string };
}

const SizePage = async ({ params }: SizePageProps) => {
  const taskId = params.taskId === "new" ? 0 : Number(params.taskId);

  const tasks = await prismadb.tasks.findUnique({
    where: {
      id: taskId,
    },
  });

  const workers = await prismadb.workers.findMany({
    where: {
      active: true,
    }
  });

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <DriversForm 
            initialData={tasks} 
            workers={workers}
        />
      </div>
    </div>
  );
};

export default SizePage;
