"use client";

import { Plus, Send } from "lucide-react";
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

interface MailingFormValues {
  targetGroup: "all" | "active_only" | "test";
  messageText: string;
}

// Схема валідації форми
const formSchema = z.object({
  // Дозволяємо пустий рядок для дефолтного стану, але вимагаємо один з варіантів при відправці
  targetGroup: z.enum(["all", "active_only", "test"], {
    required_error: "Будь ласка, оберіть цільову аудиторію",
  }),
  messageText: z.string().min(5, {
    message: "Повідомлення має містити мінімум 5 символів",
  }),
});

//type MailingFormValues = z.infer<typeof formSchema>;

export const MailingClient = ({}) => {
  const params = useParams();
  const router = useRouter();

  // Ініціалізація форми за допомогою react-hook-form
  const form = useForm<MailingFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      targetGroup: "test",
      messageText: "",
    },
  });

  const [isLoading, setIsLoading] = useState(false);

  //const isLoading = form.formState.isSubmitting;

  // Обробник відправки форми
  const onSubmit = async (data: MailingFormValues) => {
    try {
      setIsLoading(true);

      // 1. Динамічні повідомлення залежно від обраного типу аудиторії
      const messages: Record<MailingFormValues["targetGroup"], string> = {
        test: "Тестову розсилку успішно відправлено адміністраторам!",
        all: "Запит на масову розсилку для ВСІХ користувачів надіслано.",
        active_only:
          "Розсилку для користувачів, неактивних за останній місяць, запущено.",
      };

      // 2. Якщо для якогось типу потрібен інший ендпоінт, це можна легко налаштувати тут:
      let url = `/api/${params.storeId}/mailing`;

      // Приклад, якщо тестові розсилки йдуть на окремий швидкий маршрут:
      // if (data.targetGroup === "test") {
      //   url = `/api/${params.storeId}/mailings/test`;
      // }

      // 3. Відправка запиту на сервер
      const response = await axios.post(url, data);

      // 4. Показ успішного сповіщення
      toast.success(
        messages[data.targetGroup] || "Розсилку успішно надіслано!"
      );

      // 5. Опціонально: перенаправлення користувача на сторінку історії розсилок
      // router.push(`/${params.storeId}/mailings`);
      // router.refresh(); // Оновити серверні компоненти, щоб побачити нову розсилку в списку
    } catch (error: any) {
      console.error("Mailing error:", error);

      // Гнучка обробка помилок сервера
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
                    disabled={isLoading}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Оберіть кому відправити..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="all">Усім користувачам</SelectItem>
                      <SelectItem value="active_only">
                        Тільки неактивним за останній місяць
                      </SelectItem>
                      <SelectItem value="test">
                        Тестова розсилка (адміністратори)
                      </SelectItem>
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
