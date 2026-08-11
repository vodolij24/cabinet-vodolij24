import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { requireApprovedAccess } from "@/lib/cabinet-access";
import { getFinanceReport } from "@/lib/finance-report";

import { FinanceClient } from "./components/finance-client";

export const dynamic = "force-dynamic";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>;
}) {
  await requireApprovedAccess();
  const sp = await searchParams;
  const result = await getFinanceReport({
    preset: sp.preset || "current_month",
    from: sp.from,
    to: sp.to,
  });

  if ("error" in result) {
    throw new Error(result.error);
  }

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <Heading
          title="Фінанси"
          description="Фінансовий звіт: паливо, інші витрати, заробітна плата. За замовчуванням — поточний календарний місяць."
        />
        <Separator />
        <FinanceClient initial={result} />
      </div>
    </div>
  );
}
