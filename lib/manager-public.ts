import prismadb from "@/lib/prismadb";
import { digitsOnlyPhone } from "@/lib/phone";
import { PUBLIC_PAGE_ROLES } from "@/lib/worker-roles";
import {
  isManagerAckOnlyTask,
  isManagerReviewableStatus,
  managerDecisionLabel,
  taskStatusLabel,
  taskTypeLabel,
} from "@/lib/task-fields";
import { parsePhotoUrls } from "@/lib/photo-urls";
import { listOpenMissingEvents } from "@/lib/collection-recount";
import { kyivDateLabel, kyivTimeLabel } from "@/lib/kyiv-date";
import { listTickets } from "@/lib/tickets";
import type { TicketThread } from "@/lib/ticket-types";

export type ManagerPublicTask = {
  id: number;
  title: string;
  description: string | null;
  baseLocation: string | null;
  dueAt: string | null;
  salaryDeduction: number | null;
  typeLabel: string;
  status: string | null;
  statusLabel: string;
  reviewable: boolean;
  /** Лише кнопка «Ознайомлений» (відхилення з утриманням) */
  ackOnly: boolean;
  technicianName: string | null;
  technicianComment: string | null;
  rejectReason: string | null;
  photoUrls: string[];
  managerDecision: string | null;
  managerDecisionLabel: string;
  deductionApplied: boolean;
  managerComment: string | null;
  reviewedAt: string | null;
};

export type ManagerPublicMissing = {
  id: number;
  handoverId: number;
  technicianName: string;
  machine: string;
  expectedSum: number;
  dateLabel: string;
  timeLabel: string;
};

export type ManagerPublicPage = {
  manager: {
    id: number;
    name: string | null;
    phoneDigits: string;
  };
  tasks: ManagerPublicTask[];
  missingEvents: ManagerPublicMissing[];
  tickets: TicketThread[];
};

export async function findManagerByPhoneDigits(phoneDigits: string) {
  const workers = await prismadb.workers.findMany({
    where: {
      role: "manager",
      OR: [{ active: true }, { active: null }],
      phone: { not: null },
    },
    select: { id: true, name: true, phone: true },
  });

  return (
    workers.find((w) => digitsOnlyPhone(w.phone) === phoneDigits) || null
  );
}

export async function findPublicWorkerByPhoneDigits(phoneDigits: string) {
  const workers = await prismadb.workers.findMany({
    where: {
      OR: [{ active: true }, { active: null }],
      phone: { not: null },
      role: { in: [...PUBLIC_PAGE_ROLES] },
    },
    select: { id: true, name: true, phone: true, role: true },
  });

  return (
    workers.find((w) => digitsOnlyPhone(w.phone) === phoneDigits) || null
  );
}

function mapManagerTask(t: {
  id: number;
  title: string;
  description: string | null;
  baseLocation: string | null;
  dueAt: Date | null;
  salaryDeduction: number | null;
  type: string;
  status: string | null;
  technicianComment: string | null;
  rejectReason: string | null;
  photoUrls: string | null;
  managerDecision: string | null;
  deductionApplied: boolean | null;
  managerComment: string | null;
  reviewedAt: Date | null;
  worker: { name: string | null } | null;
}): ManagerPublicTask {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    baseLocation: t.baseLocation,
    dueAt: t.dueAt ? t.dueAt.toLocaleDateString("uk-UA") : null,
    salaryDeduction: t.salaryDeduction,
    typeLabel: taskTypeLabel(t.type),
    status: t.status,
    statusLabel: taskStatusLabel(t.status),
    reviewable: isManagerReviewableStatus(t.status),
    ackOnly: isManagerAckOnlyTask(t),
    technicianName: t.worker?.name || null,
    technicianComment: t.technicianComment,
    rejectReason: t.rejectReason,
    photoUrls: parsePhotoUrls(t.photoUrls),
    managerDecision: t.managerDecision,
    managerDecisionLabel: managerDecisionLabel(
      t.managerDecision,
      t.deductionApplied
    ),
    deductionApplied: Boolean(t.deductionApplied),
    managerComment: t.managerComment,
    reviewedAt: t.reviewedAt
      ? t.reviewedAt.toLocaleDateString("uk-UA")
      : null,
  };
}

export async function getManagerPublicPage(
  phoneDigits: string
): Promise<ManagerPublicPage | null> {
  const manager = await findManagerByPhoneDigits(phoneDigits);
  if (!manager) return null;

  const [taskRows, missingRows, tickets] = await Promise.all([
    prismadb.tasks.findMany({
    where: {
      OR: [
        {
          status: {
            in: [
              "awaiting_manager_confirm",
              "awaiting_manager_decision",
              "awaiting_manager_ack",
            ],
          },
        },
        {
          status: "done",
          managerDecision: { not: null },
        },
      ],
    },
    orderBy: [{ updatedAt: "desc" }],
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
      managerComment: true,
      reviewedAt: true,
      worker: { select: { name: true } },
    },
    }),
    listOpenMissingEvents(),
    listTickets({ status: "open" }).catch((error) => {
      console.error("[MANAGER_TICKETS]", error);
      return [] as TicketThread[];
    }),
  ]);

  return {
    manager: {
      id: manager.id,
      name: manager.name,
      phoneDigits,
    },
    tasks: taskRows.map(mapManagerTask),
    missingEvents: missingRows.map((e) => ({
      id: e.id,
      handoverId: e.handoverId,
      technicianName: e.technicianName,
      machine: e.machine,
      expectedSum: e.expectedSum,
      dateLabel: kyivDateLabel(e.createdAt),
      timeLabel: kyivTimeLabel(e.createdAt),
    })),
    tickets,
  };
}
