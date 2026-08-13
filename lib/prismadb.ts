import { PrismaClient } from "@/lib/generated/prisma";

declare global {
  var prisma: PrismaClient | undefined;
  var prismaStamp: string | undefined;
}

const CLIENT_STAMP = "collections-technicianId-v1";

function createPrismaClient() {
  return new PrismaClient();
}

if (
  process.env.NODE_ENV !== "production" &&
  globalThis.prismaStamp !== CLIENT_STAMP
) {
  if (globalThis.prisma) {
    void globalThis.prisma.$disconnect().catch(() => undefined);
  }
  globalThis.prisma = undefined;
  globalThis.prismaStamp = CLIENT_STAMP;
}

let prismadb = globalThis.prisma ?? createPrismaClient();

// Після prisma generate старий singleton у globalThis може бути без нових моделей
if (
  process.env.NODE_ENV !== "production" &&
  !(prismadb as { technicianManualBonus?: { findMany?: unknown } })
    .technicianManualBonus?.findMany
) {
  void prismadb.$disconnect().catch(() => undefined);
  prismadb = createPrismaClient();
}

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prismadb;
}

export default prismadb;
