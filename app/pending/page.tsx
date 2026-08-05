import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

import { ensureCabinetAccess } from "@/lib/cabinet-access";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export default async function PendingPage({
  searchParams,
}: {
  searchParams: Promise<{ rejected?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const access = await ensureCabinetAccess();
  if (!access) {
    redirect("/sign-in");
  }

  if (access.status === "approved") {
    redirect("/");
  }

  const params = await searchParams;
  const rejected = params.rejected === "1" || access.status === "rejected";

  return (
    <div className="flex min-h-screen flex-col">
      <div className="border-b">
        <div className="flex h-16 items-center justify-end gap-4 px-4">
          <ThemeToggle />
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-lg space-y-4 text-center">
          <Heading
            title={rejected ? "Доступ відхилено" : "Очікуйте підтвердження"}
            description={
              rejected
                ? "Адміністратор відхилив ваш запит. Зверніться до відповідального, якщо це помилка."
                : "Ви успішно увійшли, але доступ до кабінету ще не підтверджено адміністратором."
            }
          />
          <Separator />
          <p className="text-sm text-muted-foreground">
            {access.email ? (
              <>
                Акаунт: <span className="font-medium text-foreground">{access.email}</span>
              </>
            ) : (
              "Після підтвердження оновіть сторінку."
            )}
          </p>
          {!rejected && (
            <p className="text-sm text-muted-foreground">
              Статус: <span className="font-medium text-amber-500">pending</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
