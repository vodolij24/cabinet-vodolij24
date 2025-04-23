"use client"

import * as z from "zod"
import axios from "axios"
import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "react-hot-toast"
import { Trash } from "lucide-react"
import { drivers } from "@/lib/generated/prisma"
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
  name: z.string().min(1, "Name is required"),
  chat_id: z.number().int().positive("Chat ID must be a positive number"),
  phone: z.string().min(1, "Phone is required"),
  registration_number: z.string().min(1, "Registration number is required"),
});

type DriversFormValues = z.infer<typeof formSchema>

interface DriversFormProps {
  initialData: drivers | null;
};

export const DriversForm: React.FC<DriversFormProps> = ({
  initialData
}) => {
  const params = useParams();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const title = initialData ? 'Редагувати водія' : 'Створити водія';
  const description = initialData ? 'Редагувати водія.' : 'Створити нового водія';
  const toastMessage = initialData ? 'Водія оновлено.' : 'Водія створено.';
  const action = initialData ? 'Зберегти зміни' : 'Створити';

  const form = useForm<DriversFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData ? {
      name: initialData.name || '',
      chat_id: Number(initialData.chat_id),
      phone: initialData.phone || '',
      registration_number: initialData.registration_number || ''
    } : {
      name: '',
      chat_id: 0,
      phone: '',
      registration_number: ''
    }
  });
  

  const onSubmit = async (data: DriversFormValues) => {
    try {
      setLoading(true);
      if (initialData) {
        await axios.patch(`/api/${params.storeId}/drivers/${initialData.id}`, data);
      } else {
        await axios.post(`/api/${params.storeId}/drivers`, data);
      }
      router.refresh();
      router.push(`/${params.storeId}/sizes`);
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
      await axios.delete(`/api/${params.storeId}/drivers/${initialData?.id}`);
      router.refresh();
      router.push(`/${params.storeId}/sizes`);
      toast.success('Водія видалено.');
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Імя</FormLabel>
                  <FormControl>
                    <Input disabled={loading} placeholder="Імя водія" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="chat_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Чат ІД</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      disabled={loading}
                      placeholder="Telegram Chat ID"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Телефон</FormLabel>
                  <FormControl>
                    <Input disabled={loading} placeholder="Номер телефону" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="registration_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Реєстраційний номер</FormLabel>
                  <FormControl>
                    <Input disabled={loading} placeholder="Номерний знак ТЗ" {...field} />
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