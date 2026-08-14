import { Separator } from "@/components/ui/separator";
import { Heading } from "@/components/ui/heading";
import { getGraphRevenue } from "@/actions/get-graph-revenue";
import { getWaterLast30Days } from "@/actions/get-water-last-30-days";
import { getBotSuccessLast30Days } from "@/actions/get-bot-success-30-days";
import { getDashboardInsightCards } from "@/actions/get-dashboard-insight-cards";
import { AnalyticsCharts } from "@/components/analytics-charts";
import {
  CashCard,
  CashHeavyDevicesCard,
  GoalsCard,
  LowBotDevicesCard,
} from "@/components/dashboard-insight-cards";
import { getCashOnHandSnapshot } from "@/lib/cash-on-hand";
import { getLastSolitonSyncAt } from "@/lib/soliton-sync";
import { kyivDateLabel, kyivTimeLabel } from "@/lib/kyiv-date";
import { SolitonRefreshButton } from "@/components/soliton-refresh-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DashboardPage = async () => {
  const [
    graphRevenue,
    waterLast30Days,
    botSuccess30Days,
    insightCards,
    cashOnHand,
    lastSolitonAt,
  ] = await Promise.all([
    getGraphRevenue(),
    getWaterLast30Days(),
    getBotSuccessLast30Days(),
    getDashboardInsightCards(),
    getCashOnHandSnapshot(),
    getLastSolitonSyncAt(),
  ]);

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Heading
            title="Аналітика"
            description="Підсумок даних. Soliton оновлюється щоночі о 03:00."
          />
          <SolitonRefreshButton
            lastSyncAt={
              lastSolitonAt
                ? `${kyivDateLabel(lastSolitonAt)} ${kyivTimeLabel(lastSolitonAt)}`
                : null
            }
          />
        </div>
        <Separator />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CashCard
            total={cashOnHand.total}
            inMachines={cashOnHand.inMachines}
            withTechnicians={cashOnHand.withTechnicians}
            machinesWithCash={cashOnHand.machinesWithCash}
            machinesCount={cashOnHand.machinesCount}
            technicians={cashOnHand.technicians}
          />
          <GoalsCard goals={insightCards.goals} />
          <LowBotDevicesCard items={insightCards.lowBotDevices} />
          <CashHeavyDevicesCard items={insightCards.cashHeavyDevices} />
        </div>

        <AnalyticsCharts
          graphRevenue={graphRevenue}
          waterLast30Days={waterLast30Days}
          botSuccess30Days={botSuccess30Days}
        />
      </div>
    </div>
  );
};

export default DashboardPage;
