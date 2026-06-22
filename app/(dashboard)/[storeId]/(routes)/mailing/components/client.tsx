"use client";

import { Send } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "react-hot-toast";
import { useState } from "react";
import axios from "axios";

// Описуємо інтерфейс для фільтра, який приходить з Prisma
interface MailingFilterItem {
  id: number;
  name: string;
  title: string;
  conditions: string;
}

interface MailingFormValues {
  targetGroup: string; // Тепер тут буде ID фільтра у вигляді рядка
  messageText: string;
}

// Схема валідації форми
const formSchema = z.object({
  targetGroup: z
    .string({
      required_error: "Будь ласка, оберіть цільову аудиторію",
    })
    .min(1, "Будь ласка, оберіть цільову аудиторію"),
  messageText: z.string().min(5, {
    message: "Повідомлення має містити мінімум 5 символів",
  }),
});

interface MailingClientProps {
  initialFilters: MailingFilterItem[]; // Передаємо масив фільтрів з сервера
}

export const MailingClient = ({ initialFilters = [] }: MailingClientProps) => {
  const params = useParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Ініціалізація форми
  const form = useForm<MailingFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      targetGroup: "", // Залишаємо пустим за замовчуванням, щоб змусити обрати
      messageText: "",
    },
  });

  // Обробник відправки форми
  const onSubmit = async (data: MailingFormValues) => {
    try {
      setIsLoading(true);

      const selectedFilter = initialFilters.find(
        (f) => f.id.toString() === data.targetGroup
      );

      const filterName = selectedFilter
        ? `"${selectedFilter.title}"`
        : "обраного фільтра";

      let url = `/api/${params.storeId}/mailing`;

      // Відправка запиту на сервер
      // ПРИМІТКА: додайте передачу testMode: true/false, якщо виведете чекбокс на інтерфейс
      const response = await axios.post(url, {
        filterId: parseInt(data.targetGroup, 10),
        messageText: data.messageText,
        testMode: true, // міняйте на значення з форми, коли вимкнете режим тесту
      });

      // Витягуємо кількість отримувачів, яку нарахував бекенд
      const count = response.data?.recipientsCount ?? 0;
      const isTest = response.data?.testMode;

      // Виводимо гарне інформативне повідомлення в тостер
      if (isTest) {
        toast.success(
          `Тест! Цільова група ${filterName} зібрала користувачів: ${count} шт. (Розсилка не виконувалась)`,
          {
            duration: 5000, // тримаємо тостер трохи довше, щоб встигнути прочитати цифру
          }
        );
      } else {
        toast.success(`Розсилку успішно активовано для ${count} користувачів!`);
      }

      form.reset({ targetGroup: "", messageText: "" });
      router.refresh();
    } catch (error: any) {
      console.error("Mailing error:", error);
      const errorMessage =
        error.response?.data?.message ||
        "Не вдалося запустити розсилку. Перевірте з'єднання або зверніться до підтримки.";

      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <>
      {/* Верхня панель */}
      <div className="flex items-center justify-between mb-4">
        <Heading
          title="Розсилки"
          description="Редагування і відслідковування розсилок"
        />
      </div>

      <Separator className="mb-6" />

      {/* Форма керування розсилкою */}
      <div className="max-w-2xl bg-card border rounded-lg p-6 shadow-sm">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Селектор принципу розсилки */}
            <FormField
              control={form.control}
              name="targetGroup"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Принцип розсилки (Цільова авдиторія)</FormLabel>
                  <Select
                    disabled={isLoading || initialFilters.length === 0}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            initialFilters.length === 0
                              ? "Немає доступних фільтрів"
                              : "Оберіть фільтр аудиторії..."
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {initialFilters.map((filter) => (
                        <SelectItem
                          key={filter.id}
                          value={filter.id.toString()}
                        >
                          {filter.title}{" "}
                          <span className="text-muted-foreground text-xs">
                            ({filter.name})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Текстове поле для повідомлення */}
            <FormField
              control={form.control}
              name="messageText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Текст повідомлення</FormLabel>
                  <FormControl>
                    <Textarea
                      disabled={isLoading}
                      placeholder="Введіть текст вашої розсилки тут... (підтримується змінні на кшталт {name})"
                      className="min-h-[150px] resize-y"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Кнопка відправки */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full md:w-auto"
            >
              <Send className="mr-2 h-4 w-4" />
              {isLoading ? "Надсилання..." : "Запустити розсилку"}
            </Button>
          </form>
        </Form>
      </div>
    </>
  );
};
