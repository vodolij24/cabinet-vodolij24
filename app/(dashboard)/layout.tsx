import { redirect } from "next/navigation";

import Navbar from "@/components/navbar";
import { auth } from "@clerk/nextjs/server";
import { requireApprovedAccess } from "@/lib/cabinet-access";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  await requireApprovedAccess();

  return (
    <>
      <Navbar />
      {children}
    </>
  );
}
