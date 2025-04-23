import { format } from "date-fns";

import prismadb from "@/lib/prismadb";

import { DriverColumn } from "./components/columns"
import { SizesClient } from "./components/client";

const SizesPage = async ({
}: {
}) => {
  const drivers = await prismadb.drivers.findMany({
    where: {
    },
    orderBy: {
      id: 'desc'
    }
  });

  const formattedSizes: DriverColumn[] = drivers.map((item) => ({
    id: item.id,
    name: item.name,
    chat_id: item.chat_id,
    phone: item.phone,
    registration_number: item.registration_number
  }));

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <SizesClient data={formattedSizes} />
      </div>
    </div>
  );
};

export default SizesPage;
