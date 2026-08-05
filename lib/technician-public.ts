import { endOfMonth, startOfMonth } from "date-fns";

import prismadb from "@/lib/prismadb";
import { digitsOnlyPhone } from "@/lib/phone";
import {
  isTechnicianActionableStatus,
  managerDecisionLabel,
  taskStatusLabel,
  taskTypeLabel,
} from "@/lib/task-fields";
import { parsePhotoUrls } from "@/lib/task-photos";

export type TechnicianPublicMachine = {
  id: number;
  name: string | null;
  location: string;
  lat: string | null;
  lon: string | null;
  status: string | null;
  waterLitersMonth: number;
};

export type TechnicianPublicTask = {
  id: number;
  title: string;
  description: string | null;
  baseLocation: string | null;
  dueAt: string | null;
  salaryDeduction: number | null;
  typeLabel: string;
  status: string | null;
  statusLabel: string;
  actionable: boolean;
  technicianComment: string | null;
  rejectReason: string | null;
  photoUrls: string[];
  managerDecisionLabel: string | null;
};

export type TechnicianPublicPage = {
  technician: {
    id: number;
    name: string | null;
    phoneDigits: string;
  };
  machines: TechnicianPublicMachine[];
  tasks: TechnicianPublicTask[];
  totalWaterLitersMonth: number;
  monthLabel: string;
};

export async function findTechnicianByPhoneDigits(phoneDigits: string) {
  const workers = await prismadb.workers.findMany({
    where: {
      role: "technician",
      OR: [{ active: true }, { active: null }],
      phone: { not: null },
    },
    select: { id: true, name: true, phone: true },
  });

  return (
    workers.find((w) => digitsOnlyPhone(w.phone) === phoneDigits) || null
  );
}

export async function getTechnicianPublicPage(
  phoneDigits: string
): Promise<TechnicianPublicPage | null> {
  const technician = await findTechnicianByPhoneDigits(phoneDigits);
  if (!technician) return null;

  const machines = await prismadb.vending_machines.findMany({
    where: { technicianId: technician.id },
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      location: true,
      lat: true,
      lon: true,
      status: true,
    },
  });

  const deviceIds = machines.map((m) => m.id);
  const from = startOfMonth(new Date());
  const to = endOfMonth(new Date());

  const waterByDevice = new Map<number, number>();
  if (deviceIds.length > 0) {
    const grouped = await prismadb.transactions.groupBy({
      by: ["device"],
      where: {
        device: { in: deviceIds },
        date: { gte: from, lte: to },
      },
      _sum: { waterFullfilled: true },
    });
    for (const row of grouped) {
      waterByDevice.set(
        row.device,
        Math.round(row._sum.waterFullfilled || 0)
      );
    }
  }

  const rows: TechnicianPublicMachine[] = machines.map((m) => ({
    id: m.id,
    name: m.name,
    location: m.location,
    lat: m.lat,
    lon: m.lon,
    status: m.status,
    waterLitersMonth: waterByDevice.get(m.id) || 0,
  }));

  const totalWaterLitersMonth = rows.reduce(
    (sum, m) => sum + m.waterLitersMonth,
    0
  );

  const monthLabel = from.toLocaleDateString("uk-UA", {
    month: "long",
    year: "numeric",
  });

  const taskRows = await prismadb.tasks.findMany({
    where: { workerId: technician.id },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      baseLocation: true,
      dueAt: true,
      salaryDeduction: true,
      type: true,
      status: true,
      technicianComment: true,
      rejectReason: true,
      photoUrls: true,
      managerDecision: true,
      deductionApplied: true,
    },
  });

  const tasks: TechnicianPublicTask[] = taskRows.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    baseLocation: t.baseLocation,
    dueAt: t.dueAt ? t.dueAt.toLocaleDateString("uk-UA") : null,
    salaryDeduction: t.salaryDeduction,
    typeLabel: taskTypeLabel(t.type),
    status: t.status,
    statusLabel: taskStatusLabel(t.status),
    actionable: isTechnicianActionableStatus(t.status),
    technicianComment: t.technicianComment,
    rejectReason: t.rejectReason,
    photoUrls: parsePhotoUrls(t.photoUrls),
    managerDecisionLabel: t.managerDecision
      ? managerDecisionLabel(t.managerDecision, t.deductionApplied)
      : null,
  }));

  return {
    technician: {
      id: technician.id,
      name: technician.name,
      phoneDigits,
    },
    machines: rows,
    tasks,
    totalWaterLitersMonth,
    monthLabel,
  };
}
