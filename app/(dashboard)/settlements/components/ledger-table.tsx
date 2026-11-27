import type { LedgerLine } from "@/lib/settlements";

function formatAmount(value: number, digits: number) {
  return value.toLocaleString("uk-UA", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function groupsOf(lines: LedgerLine[]) {
  const groups: { key: string; label: string | null; lines: LedgerLine[] }[] = [];
  for (const line of lines) {
    const last = groups[groups.length - 1];
    if (!last || last.key !== line.monthKey) {
      groups.push({ key: line.monthKey, label: line.monthLabel, lines: [line] });
    } else {
      last.lines.push(line);
    }
  }
  return groups;
}

export function LedgerTable({
  lines,
  digits,
}: {
  lines: LedgerLine[];
  digits: number;
}) {
  const groups = groupsOf(lines);
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="bg-amber-100/80 text-left dark:bg-amber-950/40">
            <th className="px-3 py-2 font-medium">Дата</th>
            <th className="px-3 py-2 text-right font-medium">Нарахування</th>
            <th className="px-3 py-2 text-right font-medium">Видача</th>
            <th className="px-3 py-2 font-medium">Призначення</th>
            <th className="px-3 py-2 text-right font-medium">Сальдо</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const accrued = group.lines.reduce((sum, line) => sum + line.accrual, 0);
            const paid = group.lines.reduce((sum, line) => sum + line.payout, 0);
            return (
              <Group
                key={group.key}
                label={group.label}
                accrued={accrued}
                paid={paid}
                digits={digits}
                lines={group.lines}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Group({
  label,
  accrued,
  paid,
  digits,
  lines,
}: {
  label: string | null;
  accrued: number;
  paid: number;
  digits: number;
  lines: LedgerLine[];
}) {
  return (
    <>
      {label ? (
        <tr className="bg-muted/50 text-xs text-muted-foreground">
          <td className="px-3 py-2 font-medium text-foreground" colSpan={3}>
            {label}
          </td>
          <td className="px-3 py-2 text-right" colSpan={2}>
            {accrued > 0 ? `нараховано ${formatAmount(accrued, digits)}` : null}
            {accrued > 0 && paid > 0 ? " · " : null}
            {paid > 0 ? `видано ${formatAmount(paid, digits)}` : null}
          </td>
        </tr>
      ) : null}
      {lines.map((line, index) => (
        <tr
          key={line.id}
          className={index % 2 === 1 ? "bg-muted/20" : undefined}
        >
          <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
            {line.dateLabel}
          </td>
          <td className="px-3 py-2 text-right tabular-nums">
            {line.accrual ? formatAmount(line.accrual, digits) : ""}
          </td>
          <td className="px-3 py-2 text-right tabular-nums text-rose-700 dark:text-rose-300">
            {line.payout ? formatAmount(-line.payout, digits) : ""}
          </td>
          <td className="px-3 py-2">{line.purpose}</td>
          <td
            className={`px-3 py-2 text-right font-medium tabular-nums ${
              line.balance < 0 ? "text-rose-700 dark:text-rose-300" : ""
            }`}
          >
            {formatAmount(line.balance, digits)}
          </td>
        </tr>
      ))}
    </>
  );
}
