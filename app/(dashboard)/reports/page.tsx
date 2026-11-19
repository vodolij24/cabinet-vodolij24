import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { getExpenseFundsReport } from "@/lib/expense-funds-report";

import { ReportsClient } from "./components/reports-client";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const expenses = await getExpenseFundsReport();

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <Heading
          title="Конструктор звітів"
          description="Окремі звіти з фінзвіту. Перший — фонди витрат за три попередні місяці."
        />
        <Separator />
        <ReportsClient expenses={expenses} />
      </div>
    </div>
  );
}
