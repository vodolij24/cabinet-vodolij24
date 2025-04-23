import prismadb from "@/lib/prismadb";

import { DriversForm } from "./components/driver-form";

const SizePage = async ({
  params
}: {
  params: { driverId: string }
}) => {
  const drivers = await prismadb.drivers.findUnique({
    where: {
      id: params.driverId === 'new' ? 0 : Number(params.driverId)
    }
  });

  return ( 
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <DriversForm initialData={drivers} />
      </div>
    </div>
  );
}

export default SizePage;
