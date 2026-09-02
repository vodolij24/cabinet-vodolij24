import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { requireApprovedAccess } from "@/lib/cabinet-access";
import { listPaymentRequests } from "@/lib/payment-requests";

import { PaymentsClient } from "./components/payments-client";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  await requireApprovedAccess();
  const items = await listPaymentRequests().catch((error) => {
    console.error("[PAYMENTS_PAGE]", error);
    return [];
  });

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <Heading
          title="Платіжний календар"
          description="Заявки на оплату: дати, пріоритети, хто оплатив і чи враховано в обліку."
        />
        <Separator />
        <PaymentsClient initialItems={items} />
      </div>
    </div>
  );
}
