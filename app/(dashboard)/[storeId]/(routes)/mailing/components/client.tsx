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
  FormDescription,
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
import { Checkbox } from "@/components/ui/checkbox"; // Імпортуємо чекбокс shadcn
import { toast } from "react-hot-toast";
import { useState } from "react";
import axios from "axios";

interface MailingFilterItem {
  id: number;
  name: string;
  title: string;
  conditions: string;
}

const formSchema = z.object({
  targetGroup: z
    .string({
      required_error: "Будь ласка, оберіть цільову аудиторію",
    })
    .min(1, "Будь ласка, оберіть цільову аудиторію"),
  messageText: z.string().min(5, {
    message: "Повідомлення має містити мінімум 5 символів",
  }),
  testMode: z.boolean(), // Просто обов'язковий boolean
});

type MailingFormValues = z.infer<typeof formSchema>;

interface MailingClientProps {
  initialFilters: MailingFilterItem[];
}

export const MailingClient = ({ initialFilters = [] }: MailingClientProps) => {
  const params = useParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<MailingFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      targetGroup: "",
      messageText: "",
      testMode: true, // Початковий стан: режим тесту активований
    },
  });

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

      // Передаємо динамічне значення testMode з форми
      const response = await axios.post(url, {
        filterId: parseInt(data.targetGroup, 10),
        messageText: data.messageText,
        testMode: data.testMode,
      });

      const count = response.data?.recipientsCount ?? 0;
      const isTest = response.data?.testMode;

      if (isTest) {
        toast.success(
          `Тест! Цільова група ${filterName} зібрала користувачів: ${count} шт. (Розсилка не виконувалась)`,
          { duration: 5000 }
        );
      } else {
        toast.success(
          `Бойову розсилку успішно активовано для ${count} користувачів!`
        );
      }

      // Скидаємо лише текстові поля, зберігаючи стан чекбокса для наступних розсилок
      form.reset({ targetGroup: "", messageText: "", testMode: data.testMode });
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
      <div className="flex items-center justify-between mb-4">
        <Heading
          title="Розсилки"
          description="Редагування і відслідковування розсилок"
        />
      </div>

      <Separator className="mb-6" />

      <div className="max-w-2xl bg-card border rounded-lg p-6 shadow-sm">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Селектор цільової аудиторії */}
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

            {/* НОВЕ ПОЛЕ: Чекбокс Режиму Тестування */}
            <FormField
              control={form.control}
              name="testMode"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm bg-slate-50/50">
                  <FormControl>
                    <Checkbox
                      disabled={isLoading}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="cursor-pointer">
                      Режим тестування розсилки
                    </FormLabel>
                    <FormDescription>
                      Якщо увімкнено — система лише підрахує кількість клієнтів.
                      Вимкніть цей прапорець, щоб надіслати реальні
                      повідомлення.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {/* Кнопка відправки */}
            <Button
              type="submit"
              disabled={isLoading}
              variant={form.watch("testMode") ? "default" : "destructive"} // Зміна кольору кнопки для застереження, якщо це БОЙОВА розсилка
              className="w-full md:w-auto"
            >
              <Send className="mr-2 h-4 w-4" />
              {isLoading
                ? "Обробка..."
                : form.watch("testMode")
                ? "Протестувати фільтр"
                : "Запустити реальну розсилку"}
            </Button>
          </form>
        </Form>
      </div>
    </>
  );
};
