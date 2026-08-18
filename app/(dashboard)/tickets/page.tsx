import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { requireApprovedAccess } from "@/lib/cabinet-access";
import { listTickets } from "@/lib/tickets";

import { TicketsClient } from "./components/tickets-client";

export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  await requireApprovedAccess();
  const tickets = await listTickets({ status: "all" }).catch((error) => {
    console.error("[TICKETS_PAGE]", error);
    return [];
  });

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <Heading
          title="Звернення"
          description="Діалоги по інкасаціях. Закриті звернення лишаються лише тут."
        />
        <Separator />
        <TicketsClient tickets={tickets} />
      </div>
    </div>
  );
}
