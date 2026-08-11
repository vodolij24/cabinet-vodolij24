import { PrismaClient } from "@/lib/generated/prisma";

declare global {
  var prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  return new PrismaClient();
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
