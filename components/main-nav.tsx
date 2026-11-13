"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type NavLink = {
  href: string;
  label: string;
};

type NavEntry =
  | { kind: "link"; href: string; label: string }
  | { kind: "group"; label: string; items: NavLink[] };

const entries: NavEntry[] = [
  { kind: "link", href: "/", label: "Аналітика" },
  { kind: "link", href: "/mailing", label: "Розсилки" },
  { kind: "link", href: "/statistics", label: "Статистика" },
  { kind: "link", href: "/tasks", label: "Задачі" },
  {
    kind: "group",
    label: "Фінанси",
    items: [
      { href: "/finance", label: "Витрати" },
      { href: "/transactions", label: "Транзакції" },
      { href: "/payments", label: "Платіжний календар" },
      { href: "/pnl", label: "Фін. звіт" },
    ],
  },
  {
    kind: "group",
    label: "Мережа",
    items: [
      { href: "/machines", label: "Облік автоматів" },
      { href: "/collections", label: "Інкасації" },
      { href: "/tickets", label: "Звернення" },
    ],
  },
  { kind: "link", href: "/settings", label: "Налаштування" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupIsActive(pathname: string, items: NavLink[]) {
  return items.some((item) => isActive(pathname, item.href));
}

function activeGroupLabel(pathname: string) {
  for (const entry of entries) {
    if (entry.kind === "group" && groupIsActive(pathname, entry.items)) {
      return entry.label;
    }
  }
  return null;
}

function itemClass(active: boolean) {
  return cn(
    "whitespace-nowrap text-sm font-medium transition-colors hover:text-primary",
    active ? "text-black dark:text-white" : "text-muted-foreground"
  );
}

export function MainNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function toggleMenu() {
    if (open) {
      setOpen(false);
      return;
    }
    setExpanded(activeGroupLabel(pathname));
    setOpen(true);
  }

  return (
    <>
      <div className="flex h-16 items-center px-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={toggleMenu}
        >
          {open ? <X /> : <Menu />}
          <span className="sr-only">
            {open ? "Закрити меню" : "Відкрити меню"}
          </span>
        </Button>

        <nav
          className="mx-6 hidden items-center gap-4 xl:gap-6 lg:flex"
          aria-label="Головне меню"
        >
          {entries.map((entry) =>
            entry.kind === "link" ? (
              <Link
                key={entry.href}
                href={entry.href}
                className={itemClass(isActive(pathname, entry.href))}
              >
                {entry.label}
              </Link>
            ) : (
              <DropdownMenu key={entry.label}>
                <DropdownMenuTrigger
                  className={cn(
                    itemClass(groupIsActive(pathname, entry.items)),
                    "inline-flex cursor-pointer items-center gap-1 bg-transparent outline-none data-[state=open]:text-black dark:data-[state=open]:text-white [&_svg]:transition-transform data-[state=open]:[&_svg]:rotate-180"
                  )}
                >
                  {entry.label}
                  <ChevronDown className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-52">
                  {entry.items.map((item) => (
                    <DropdownMenuItem
                      key={item.href}
                      asChild
                      className={cn(
                        "cursor-pointer",
                        isActive(pathname, item.href) &&
                          "bg-accent font-medium text-foreground"
                      )}
                    >
                      <Link href={item.href}>{item.label}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )
          )}
        </nav>

        {children}
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          aria-label="Головне меню"
          className="border-t px-2 py-2 lg:hidden"
        >
          {entries.map((entry) =>
            entry.kind === "link" ? (
              <Link
                key={entry.href}
                href={entry.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "block rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent",
                  isActive(pathname, entry.href)
                    ? "bg-accent text-black dark:text-white"
                    : "text-muted-foreground"
                )}
              >
                {entry.label}
              </Link>
            ) : (
              <div key={entry.label}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent",
                    groupIsActive(pathname, entry.items)
                      ? "text-black dark:text-white"
                      : "text-muted-foreground"
                  )}
                  aria-expanded={expanded === entry.label}
                  onClick={() =>
                    setExpanded((current) =>
                      current === entry.label ? null : entry.label
                    )
                  }
                >
                  {entry.label}
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform",
                      expanded === entry.label && "rotate-180"
                    )}
                  />
                </button>
                {expanded === entry.label ? (
                  <div className="pb-1 pl-3">
                    {entry.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "block rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
                          isActive(pathname, item.href)
                            ? "bg-accent font-medium text-black dark:text-white"
                            : "text-muted-foreground"
                        )}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          )}
        </nav>
      ) : null}
    </>
  );
}
