import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { getExpenseFundsReport } from "@/lib/expense-funds-report";
import { listReportFundNotes } from "@/lib/report-notes";

import { ReportsClient } from "./components/reports-client";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [expenses, notes] = await Promise.all([
    getExpenseFundsReport(),
    listReportFundNotes(),
  ]);

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <Heading
          title="Конструктор звітів"
          description="Окремі звіти з фінзвіту. Перший — фонди витрат за три попередні місяці."
        />
        <Separator />
        <ReportsClient expenses={expenses} notes={notes} />
      </div>
    </div>
  );
}
