import type { Metadata } from "next";

import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Vodolij · Технік",
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f0f9ff] text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex max-w-3xl justify-end px-4 pt-4 sm:px-6">
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}
