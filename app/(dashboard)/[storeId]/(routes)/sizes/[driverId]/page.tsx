
import prismadb from "@/lib/prismadb";
import { DriversForm } from "./components/driver-form";

type SizePageProps = {
  params: {
    storeId: string; // ← you actually have storeId too in your route
    driverId: string;
  };
};

const SizePage = async ({ params }: SizePageProps) => {
  const drivers = await prismadb.drivers.findUnique({
    where: {
      id: params.driverId === "new" ? 0 : Number(params.driverId),
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
