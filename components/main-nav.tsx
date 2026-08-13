"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function MainNav({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const pathname = usePathname();

  const routes = [
    {
      href: `/`,
      label: "Аналітика",
      active: pathname === `/`,
    },
    {
      href: `/mailing`,
      label: "Розсилки",
      active: pathname === `/mailing`,
    },
    {
      href: `/statistics`,
      label: "Статистика",
      active: pathname === `/statistics`,
    },
    {
      href: `/transactions`,
      label: "Транзакції",
      active: pathname === `/transactions`,
    },
    {
      href: `/tasks`,
      label: "Задачі",
      active: pathname === `/tasks`,
    },
    {
      href: `/finance`,
      label: "Фінанси",
      active: pathname === `/finance` || pathname.startsWith(`/finance/`),
    },
    {
      href: `/machines`,
      label: "Автомати",
      active: pathname === `/machines` || pathname.startsWith(`/machines/`),
    },
    {
      href: `/collections`,
      label: "Інкасації",
      active:
        pathname === `/collections` || pathname.startsWith(`/collections/`),
    },
    {
      href: `/settings`,
      label: "Налаштування",
      active: pathname === `/settings` || pathname.startsWith(`/settings/`),
    },
  ];

  return (
    <nav
      className={cn("flex items-center space-x-4 lg:space-x-6", className)}
      {...props}
    >
      {routes.map((route) => (
        <Link
          key={route.href}
          href={route.href}
          className={cn(
            "text-sm font-medium transition-colors hover:text-primary",
            route.active
              ? "text-black dark:text-white"
              : "text-muted-foreground"
          )}
        >
          {route.label}
        </Link>
      ))}
    </nav>
  );
}
