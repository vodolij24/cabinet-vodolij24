import Link from "next/link";
import { notFound } from "next/navigation";

import { requireApprovedAccess } from "@/lib/cabinet-access";
import {
  getSettlementDetail,
  parseSettlementYear,
} from "@/lib/settlements";
import { cn } from "@/lib/utils";

import { LedgerTable } from "../components/ledger-table";

export const dynamic = "force-dynamic";

function money(amount: number, unit: string, digits: number) {
  const formatted = amount.toLocaleString("uk-UA", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return unit === "$" ? `${formatted} $` : `${formatted} ${unit}`;
}

export default async function SettlementDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  await requireApprovedAccess();
  const { slug } = await params;
  const sp = await searchParams;
  const year = parseSettlementYear(sp.year, slug === "grishchenko");
  const detail = await getSettlementDetail(slug, year).catch(() => null);
  if (!detail) notFound();

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-6 p-8 pt-6">
        <div className="space-y-2">
          <Link
            href="/settlements"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Взаєморозрахунки
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">{detail.name}</h2>
              <p className="max-w-2xl text-sm text-muted-foreground">{detail.hint}</p>
            </div>
            <div className="flex flex-wrap gap-6">
              {detail.books.map((book) => (
                <div key={book.currency} className="text-right">
                  <div
                    className={`text-2xl font-semibold tabular-nums ${
                      book.balance < 0 ? "text-rose-700 dark:text-rose-300" : ""
                    }`}
                  >
                    {money(book.balance, book.unit, book.digits)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {detail.kind === "employee"
                      ? "нараховано за рік"
                      : book.currency === "UAH"
                        ? "борг у гривнях"
                        : "борг у доларах"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 text-sm">
          {detail.yearLinks.map((link) => {
            const active = link.year === detail.year;
            const href =
              link.year === "all"
                ? `/settlements/${detail.slug}?year=all`
                : `/settlements/${detail.slug}?year=${link.year}`;
            return (
              <Link
                key={String(link.year)}
                href={href}
                className={cn(
                  "rounded-md px-3 py-1.5",
                  active
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {detail.books.map((book) => (
          <section key={book.currency} className="space-y-2">
            {detail.books.length > 1 ? (
              <h3 className="text-sm font-medium">
                {book.currency === "UAH" ? "Гривні" : "Долари"}
              </h3>
            ) : null}
            {book.lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">За цей період рухів немає.</p>
            ) : (
              <LedgerTable lines={book.lines} digits={book.digits} />
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
