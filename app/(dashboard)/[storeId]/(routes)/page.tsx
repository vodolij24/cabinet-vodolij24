import { CreditCard, DollarSign, Package } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Overview } from "@/components/overview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { getTotalRevenue } from "@/actions/get-total-revenue";
import { getSalesCount } from "@/actions/get-sales-count";
import { getGraphRevenue } from "@/actions/get-graph-revenue";
import { getStockCount } from "@/actions/get-stock-count";
import { formatter } from "@/lib/utils";
import { RechartBot } from "@/components/rechatbot";
import { getBotVsTotalGraphRevenue } from "@/actions/get-botvstotal-water";
/*
interface DashboardPageProps {
  params: {
    storeId: string;
  };
}
*/
const DashboardPage = async () => {
  const totalRevenue = await getTotalRevenue();
  const graphRevenue = await getGraphRevenue();
  const salesCount = await getSalesCount();
  const stockCount = await getStockCount();
  const botVsTotalWater = await getBotVsTotalGraphRevenue();
  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <Heading title="Аналітика" description="Підсумок данних" />
        <Separator />

        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Отримано коштів. Готівка + онлайн</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <Overview data={graphRevenue} />
          </CardContent>
        </Card>
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Користувачі бота vs Усі транзакції</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <RechartBot data={botVsTotalWater} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
