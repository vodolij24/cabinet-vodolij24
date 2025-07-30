import prismadb from "@/lib/prismadb";
import { DriversForm } from "./components/driver-form";

interface SizePageProps {
  params: Promise<{
    taskId: string; // 'driverId' comes as a string from URL parameters
  }>;
}

const SizePage = async ({ params }: SizePageProps) => {
  // Convert driverId from string to number
  const taskId =
    (await params).taskId === "new" ? 0 : Number((await params).taskId);

  // Query the database using the number
  const tasks = await prismadb.tasks.findUnique({
    where: {
      id: taskId, // `id` is expected to be a number here
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
