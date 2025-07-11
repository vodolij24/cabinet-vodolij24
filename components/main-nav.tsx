"use client";

import Link from "next/link"
import { useParams, usePathname } from "next/navigation";

import { cn } from "@/lib/utils"

export function MainNav({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const pathname = usePathname();
  const params = useParams();

  const routes = [
    {
      href: `/${params.storeId}`,
      label: 'Аналітика',
      active: pathname === `/${params.storeId}`,
    },
    {
      href: `/${params.storeId}/categories`,
      label: 'Ачівки',
      active: pathname === `/${params.storeId}/categories`,
    },
    {
      href: `/${params.storeId}/sizes`,
      label: 'Статистика',
      active: pathname === `/${params.storeId}/sizes`,
    },
    {
      href: `/${params.storeId}/colors`,
      label: 'Користувачі',
      active: pathname === `/${params.storeId}/colors`,
    },
    {
      href: `/${params.storeId}/transactions`,
      label: 'Транзакції',
      active: pathname === `/${params.storeId}/transactions`,
    },
    {
      href: `/${params.storeId}/orders`,
      label: 'Картки',
      active: pathname === `/${params.storeId}/orders`,
    },
    {
      href: `/${params.storeId}/tasks`,
      label: 'Задачі',
      active: pathname === `/${params.storeId}/tasks`,
    },
  ]

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
            'text-sm font-medium transition-colors hover:text-primary',
            route.active ? 'text-black dark:text-white' : 'text-muted-foreground'
          )}
        >
          {route.label}
      </Link>
      ))}
    </nav>
  )
};
