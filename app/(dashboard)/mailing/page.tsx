import prismadb from "@/lib/prismadb";
import { MailingClient } from "./components/client";

const MailingPage = async () => {
  const filters = await prismadb.mailingFilter.findMany({
    orderBy: {
      id: "desc",
    },
  });

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <MailingClient initialFilters={filters} />
      </div>
    </div>
  );
};

export default MailingPage;
