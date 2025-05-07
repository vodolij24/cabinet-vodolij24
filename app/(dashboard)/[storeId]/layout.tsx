import { redirect } from "next/navigation";

import Navbar from "@/components/navbar";
import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs/server";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeId: string }>;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }
/*
  const store = await prismadb.store.findFirst({
    where: {
      id: (await params).storeId,
      userId,
    },
  });

  if (!store) {
    redirect("/");
  }
*/
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}
