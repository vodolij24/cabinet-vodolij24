"use client"

import * as z from "zod"
import axios from "axios"
import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "react-hot-toast"
import { Trash } from "lucide-react"
import { tasks } from "@/lib/generated/prisma"
import { useParams, useRouter } from "next/navigation"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Separator } from "@/components/ui/separator"
import { Heading } from "@/components/ui/heading"
import { AlertModal } from "@/components/modals/alert-modal"

const formSchema = z.object({
  title: z.string().min(1, "Заголовок завдання обовязковий"),
  deviceId: z.number().int().positive("DEVICE ID POSITIVE NUMBER"),
  description: z.string() ,
  priority: z.string() ,
});

type TaskFormValues = z.infer<typeof formSchema>

interface TaskFormProps {
  initialData: tasks | null;
};

export const DriversForm: React.FC<TaskFormProps> = ({
  initialData
}) => {
  const params = useParams();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const title = initialData ? 'Редагувати завдання' : 'Створити завдання';
  const description = initialData ? 'Редагувати завдання.' : 'Створити завдання';
  const toastMessage = initialData ? 'Завдання оновлено.' : 'Завдання створено.';
  const action = initialData ? 'Зберегти зміни' : 'Створити';

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData ? {
      title: initialData.title || '',
      deviceId: Number(initialData.deviceId) || 0,
      description: initialData.description || '',
      priority: initialData.priority || 'medium',
    } : {
      title: '',
      deviceId: 0,
      description: '',
      priority: 'medium',
    }
  });
  

  const onSubmit = async (data: TaskFormValues) => {
    try {
      setLoading(true);
      if (initialData) {
        await axios.patch(`/api/${params.storeId}/tasks/${initialData.id}`, data);
      } else {
        await axios.post(`/api/${params.storeId}/tasks`, data);
      }
      router.refresh();
      router.push(`/${params.storeId}/tasks`);
      toast.success(toastMessage);
    } catch (error: any) {
      toast.error('Трапилась помилка.');
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    try {
      setLoading(true);
      await axios.delete(`/api/${params.storeId}/tasks/${initialData?.id}`);
      router.refresh();
      router.push(`/${params.storeId}/tasks`);
      toast.success('Завдання видалено.');
    } catch (error: any) {
      toast.error('Make sure you removed all related data first.');
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <>
      <AlertModal 
        isOpen={open} 
        onClose={() => setOpen(false)}
        onConfirm={onDelete}
        loading={loading}
      />

      <div className="flex items-center justify-between">
        <Heading title={title} description={description} />
        {initialData && (
          <Button
            disabled={loading}
            variant="destructive"
            size="sm"
            onClick={() => setOpen(true)}
          >
            <Trash className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Separator />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 w-full">
          <div className="md:grid md:grid-cols-2 gap-8">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Завдання</FormLabel>
                  <FormControl>
                    <Input disabled={loading} placeholder="Заголовок завдання" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="deviceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Апарат</FormLabel>
                  <FormControl>
                    <Input type="number" disabled={loading} placeholder="Номер апарату" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Опис завдання</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Опис завдання"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Пріорітет</FormLabel>
                  <FormControl>
                    <Input disabled={loading} placeholder="Пріорітет" {...field} 

                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

          </div>

          <Button disabled={loading} className="ml-auto" type="submit">
            {action}
          </Button>
        </form>
      </Form>
    </>
  );
};