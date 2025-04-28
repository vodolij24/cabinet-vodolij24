import prismadb from "@/lib/prismadb";
import { DriversForm } from "./components/driver-form";

interface SizePageProps {
  params: {
    driverId: string;  // 'driverId' comes as a string from URL parameters
  };
}

const SizePage = async ({ params }: SizePageProps) => {
  // Convert driverId from string to number
  const driverId = params.driverId === 'new' ? 0 : Number(params.driverId);

  // Query the database using the number
  const drivers = await prismadb.drivers.findUnique({
    where: {
      id: driverId,  // `id` is expected to be a number here
    },
  });

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <DriversForm initialData={drivers} />
      </div>
    </div>
  );
};

export default SizePage;
