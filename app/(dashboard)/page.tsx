import { Separator } from "@/components/ui/separator";
import { Overview } from "@/components/overview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { getGraphRevenue } from "@/actions/get-graph-revenue";
import { getWaterLast30Days } from "@/actions/get-water-last-30-days";
import { getBotSuccessLast30Days } from "@/actions/get-bot-success-30-days";
import { getDashboardInsightCards } from "@/actions/get-dashboard-insight-cards";
import { Water30DaysChart } from "@/components/water-30-days-chart";
import { BotWater30DaysChart } from "@/components/bot-water-30-days-chart";
import { BotSuccess30DaysChart } from "@/components/bot-success-30-days-chart";
import { BotInactive30DaysChart } from "@/components/bot-inactive-30-days-chart";
import {
  CashCard,
  CashHeavyDevicesCard,
  GoalsCard,
  LowBotDevicesCard,
} from "@/components/dashboard-insight-cards";
import { getCashOnHandSnapshot } from "@/lib/cash-on-hand";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DashboardPage = async () => {
  const [
    graphRevenue,
    waterLast30Days,
    botSuccess30Days,
    insightCards,
    cashOnHand,
  ] = await Promise.all([
    getGraphRevenue(),
    getWaterLast30Days(),
    getBotSuccessLast30Days(),
    getDashboardInsightCards(),
    getCashOnHandSnapshot(),
  ]);

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <Heading title="Аналітика" description="Підсумок данних" />
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

        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>
              Мережа за 30 днів: налито води та частка готівки
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <Water30DaysChart data={waterLast30Days} />
          </CardContent>
        </Card>

        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>
              Бот: налито води та активні користувачі за останні 30 днів
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <BotWater30DaysChart data={waterLast30Days} />
          </CardContent>
        </Card>

        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Отримано коштів за останні 12 місяців</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <Overview data={graphRevenue} />
          </CardContent>
        </Card>

        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>
              Успіх бота за 30 днів: частка та повернення
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <BotSuccess30DaysChart data={botSuccess30Days} />
          </CardContent>
        </Card>

        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>
              Бот за 30 днів: усього, активні, неактивні та недореєстровані (шт)
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <BotInactive30DaysChart data={botSuccess30Days} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
