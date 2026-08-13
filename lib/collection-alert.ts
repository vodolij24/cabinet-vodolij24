export type RecountAlert = "alarm" | "warning" | "success" | "pending";
export type HandoverAlert = RecountAlert | "progress";

export function recountAlert(input: {
  handedOver: boolean;
  recountStatus: string | null;
  difference: number | null;
}): RecountAlert | null {
  if (!input.handedOver) return null;
  if (input.recountStatus === "missing") return "alarm";
  if (input.difference == null) return "pending";
  const abs = Math.abs(input.difference);
  if (abs > 1000) return "alarm";
  if (abs > 200) return "warning";
  return "success";
}

export function handoverAlert(
  packages: Array<{
    handedOver: boolean;
    recountStatus: string | null;
    difference: number | null;
  }>
): HandoverAlert {
  const alerts = packages.map((pkg) => recountAlert(pkg));
  if (alerts.includes("alarm")) return "alarm";
  if (alerts.includes("warning")) return "warning";
  if (alerts.length > 0 && alerts.every((a) => a === "success")) {
    return "success";
  }
  if (alerts.length > 0 && alerts.every((a) => a === "pending" || a == null)) {
    return "pending";
  }
  return "progress";
}
