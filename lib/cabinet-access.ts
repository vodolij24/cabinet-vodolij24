import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import prismadb from "@/lib/prismadb";

export type CabinetStatus = "pending" | "approved" | "rejected";
export type CabinetRole = "admin";

export type CabinetAccessRecord = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

function bootstrapEmails(): string[] {
  const raw = process.env.CABINET_ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isBootstrapAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return bootstrapEmails().includes(email.toLowerCase());
}

/** Створює/оновлює запис доступу після логіну Clerk */
export async function ensureCabinetAccess(): Promise<CabinetAccessRecord | null> {
  const user = await currentUser();
  if (!user) return null;

  const email =
    user.primaryEmailAddress?.emailAddress ||
    user.emailAddresses[0]?.emailAddress ||
    null;
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username ||
    null;

  const existing = await prismadb.cabinetAccess.findUnique({
    where: { id: user.id },
  });

  if (existing) {
    const approvedCount = await prismadb.cabinetAccess.count({
      where: { status: "approved" },
    });

    // Bootstrap: якщо ще нікого не підтверджено — перший вхід стає admin
    if (
      existing.status !== "approved" &&
      (isBootstrapAdmin(email) || approvedCount === 0)
    ) {
      return prismadb.cabinetAccess.update({
        where: { id: user.id },
        data: {
          email,
          name,
          status: "approved",
          role: "admin",
        },
      });
    }

    if (
      (email && email !== existing.email) ||
      (name && name !== existing.name)
    ) {
      return prismadb.cabinetAccess.update({
        where: { id: user.id },
        data: { email: email ?? existing.email, name: name ?? existing.name },
      });
    }

    return existing;
  }

  // Перший користувач у системі — автоматично admin (bootstrap без .env)
  const approvedCount = await prismadb.cabinetAccess.count({
    where: { status: "approved" },
  });
  const approved = isBootstrapAdmin(email) || approvedCount === 0;

  return prismadb.cabinetAccess.create({
    data: {
      id: user.id,
      email,
      name,
      role: "admin",
      status: approved ? "approved" : "pending",
    },
  });
}

export async function requireApprovedAccess(): Promise<CabinetAccessRecord> {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const access = await ensureCabinetAccess();
  if (!access) {
    redirect("/sign-in");
  }

  if (access.status === "pending") {
    redirect("/pending");
  }

  if (access.status !== "approved") {
    redirect("/pending?rejected=1");
  }

  return access;
}

/** Для API: без redirect, кидає Error з кодом у message */
export async function assertApprovedAccess(): Promise<CabinetAccessRecord> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }

  const access = await ensureCabinetAccess();
  if (!access) {
    throw new Error("UNAUTHORIZED");
  }

  if (access.status !== "approved") {
    throw new Error("FORBIDDEN");
  }

  return access;
}

export async function listCabinetUsers(): Promise<CabinetAccessRecord[]> {
  return prismadb.cabinetAccess.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function setCabinetUserStatus(
  targetId: string,
  status: CabinetStatus
): Promise<CabinetAccessRecord> {
  return prismadb.cabinetAccess.update({
    where: { id: targetId },
    data: { status, role: "admin" },
  });
}
