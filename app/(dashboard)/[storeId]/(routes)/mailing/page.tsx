// Замініть на ваш правильний шлях до клієнта Prisma
import prismadb from "@/lib/prismadb";
import { MailingClient } from "./components/client";

// Якщо сторінка приймає параметри (наприклад, storeId з URL), додаємо їх у пропси
interface MailingPageProps {
  params: Promise<{ storeId: string }> | { storeId: string }; // Залежно від версії Next.js 14/15
}

const MailingPage = async ({ params }: MailingPageProps) => {
  // Очікуємо параметри, якщо це Next.js 15 (у Next.js 14 це можна прибрати)
  const resolvedParams = await params;

  // Завантажуємо всі фільтри розсилок з бази даних
  const filters = await prismadb.mailingFilter.findMany({
    orderBy: {
      id: "desc", // Нові фільтри будуть зверху списку
    },
  });

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        {/* Передаємо завантажені фільтри у клієнтський компонент */}
        <MailingClient initialFilters={filters} />
      </div>
    </div>
  );
};

export default MailingPage;
