import Link from "next/link";

import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { requireApprovedAccess } from "@/lib/cabinet-access";
import { listSettlementPeople } from "@/lib/settlements";

export const dynamic = "force-dynamic";

function money(amount: number, unit: string, digits: number) {
  const formatted = amount.toLocaleString("uk-UA", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return unit === "$" ? `${formatted} $` : `${formatted} ${unit}`;
}

export default async function SettlementsPage() {
  await requireApprovedAccess();
  const { grishchenko, employees, year } = await listSettlementPeople();

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <Heading
          title="Взаєморозрахунки"
          description="Нарахування збільшує борг, видача зменшує. Сальдо — скільки лишилось."
        />
        <Separator />

        {grishchenko ? (
          <Link
            href={`/settlements/${grishchenko.slug}`}
            className="flex flex-wrap items-center justify-between gap-4 rounded-lg border px-4 py-4 hover:bg-muted/40"
          >
            <div>
              <div className="text-lg font-semibold">{grishchenko.name}</div>
              <div className="text-sm text-muted-foreground">{grishchenko.hint}</div>
            </div>
            <div className="text-right">
              {grishchenko.books.map((book) => (
                <div key={book.currency} className="text-lg font-semibold tabular-nums">
                  {money(book.balance, book.unit, book.digits)}
                </div>
              ))}
              <div className="text-xs text-muted-foreground">залишок боргу</div>
            </div>
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">
            Журнал Грищенка зараз не прочитався.
          </p>
        )}

        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Співробітники · зарплата за {year}
          </h3>
          {employees.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Немає техніків, яким цього року рахується зарплата.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Імʼя</th>
                    <th className="px-4 py-2 text-right font-medium">Нараховано</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((person) => {
                    const book = person.books[0];
                    return (
                      <tr key={person.slug} className="border-b last:border-0">
                        <td colSpan={2} className="p-0">
                          <Link
                            href={`/settlements/${person.slug}`}
                            className="flex items-center justify-between px-4 py-3 hover:bg-muted/40"
                          >
                            <span className="font-medium">{person.name}</span>
                            <span className="font-medium tabular-nums">
                              {book
                                ? money(book.balance, book.unit, book.digits)
                                : "—"}
                            </span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
