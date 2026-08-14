import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { requireApprovedAccess } from "@/lib/cabinet-access";
import { isPeriodKey } from "@/lib/finance-month";
import { kyivPeriodKey } from "@/lib/pnl-constants";
import { getPnlPage } from "@/lib/pnl";

import { PnlClient } from "./components/pnl-client";

export const dynamic = "force-dynamic";

export default async function PnlPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireApprovedAccess();
  const sp = await searchParams;
  const period =
    sp.period && isPeriodKey(sp.period) ? sp.period : kyivPeriodKey();
  const data = await getPnlPage(period);

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <Heading
          title={`Фін. звіт · ${data.periodLabel}`}
          description="Підсумок місяця. Ручні блоки і таблиці можна зберігати кілька днів, потім прийняти. Архів — інший місяць у списку."
        />
        <Separator />
        <PnlClient initial={data} />
      </div>
    </div>
  );
}
