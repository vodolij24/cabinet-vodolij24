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

// Схема валідації форми
const formSchema = z.object({
  targetGroup: z.string({
    required_error: "Будь ласка, виберіть принцип розсилки",
  }),
  messageText: z.string().min(10, {
    message: "Текст розсилки має бути не менше 10 символів",
  }),
});

type MailingFormValues = z.infer<typeof formSchema>;

export const MailingClient = ({}) => {
  const params = useParams();
  const router = useRouter();

  // Ініціалізація форми за допомогою react-hook-form
  const form = useForm<MailingFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      targetGroup: "",
      messageText: "",
    },
  });

  const isLoading = form.formState.isSubmitting;

  // Обробник відправки форми
  const onSubmit = async (data: MailingFormValues) => {
    try {
      console.log("Дані для розсилки:", data);
      // Тут буде твій запит до API, наприклад:
      // await axios.post(`/api/${params.storeId}/mailings`, data);

      form.reset();
    } catch (error) {
      console.error("Помилка при відправці розсилки", error);
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
        <Button onClick={() => router.push(`/${params.storeId}/mailings/new`)}>
          <Plus className="mr-2 h-4 w-4" /> Додати шаблон
        </Button>
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
                        Тільки активним за останній тиждень
                      </SelectItem>
                      <SelectItem value="with_orders">
                        Користувачам із замовленнями
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
