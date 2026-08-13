"use client";

import * as z from "zod";
import axios from "axios";
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { Trash } from "lucide-react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Heading } from "@/components/ui/heading";
import { AlertModal } from "@/components/modals/alert-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { machineLabel } from "@/lib/collection-fields";
import {
  kyivDateInputValue,
  kyivTimeInputValue,
} from "@/lib/kyiv-date";

const formSchema = z.object({
  deviceId: z.string().min(1, "Оберіть автомат"),
  date: z.string().min(1, "Вкажіть дату"),
  time: z.string().min(1, "Вкажіть час"),
  countCoins: z.string().min(1, "Вкажіть кількість"),
  sumCoins: z.string().min(1, "Вкажіть суму"),
  countBanknotes: z.string().min(1, "Вкажіть кількість"),
  sumBanknotes: z.string().min(1, "Вкажіть суму"),
  note: z.string(),
});

type CollectionFormValues = z.infer<typeof formSchema>;

export type CollectionFormData = {
  id: number;
  deviceId: number | null;
  date: string;
  time: string;
  countCoins: number;
  sumCoins: number;
  countBanknotes: number;
  sumBanknotes: number;
  note: string | null;
};

type MachineOption = {
  id: number;
  name: string | null;
  location: string;
  technicianId: number | null;
  technicianName: string | null;
};

interface CollectionFormProps {
  initialData: CollectionFormData | null;
  machines: MachineOption[];
}

function moneyPreview(n: number) {
  return n.toLocaleString("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const CollectionForm: React.FC<CollectionFormProps> = ({
  initialData,
  machines,
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!initialData;

  const now = new Date();
  const form = useForm<CollectionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData
      ? {
          deviceId: initialData.deviceId ? String(initialData.deviceId) : "",
          date: initialData.date,
          time: initialData.time,
          countCoins: String(initialData.countCoins),
          sumCoins: String(initialData.sumCoins),
          countBanknotes: String(initialData.countBanknotes),
          sumBanknotes: String(initialData.sumBanknotes),
          note: initialData.note || "",
        }
      : {
          deviceId: "",
          date: kyivDateInputValue(now),
          time: kyivTimeInputValue(now),
          countCoins: "0",
          sumCoins: "0",
          countBanknotes: "0",
          sumBanknotes: "0",
          note: "",
        },
  });

  const deviceId = form.watch("deviceId");
  const sumCoins = form.watch("sumCoins");
  const sumBanknotes = form.watch("sumBanknotes");

  const selectedMachine = useMemo(
    () => machines.find((m) => String(m.id) === deviceId) || null,
    [machines, deviceId]
  );

  const total =
    (parseFloat(String(sumCoins).replace(",", ".")) || 0) +
    (parseFloat(String(sumBanknotes).replace(",", ".")) || 0);

  const title = isEdit ? "Редагувати інкасацію" : "Нова інкасація";
  const description = isEdit
    ? "Змінити дані інкасації."
    : "Технік підставляється з відповідального за автомат.";
  const toastMessage = isEdit ? "Інкасацію оновлено." : "Інкасацію створено.";
  const action = isEdit ? "Зберегти зміни" : "Створити";

  const onSubmit = async (data: CollectionFormValues) => {
    try {
      setLoading(true);
      const payload = {
        deviceId: parseInt(data.deviceId, 10),
        date: data.date,
        time: data.time,
        countCoins: data.countCoins,
        sumCoins: data.sumCoins,
        countBanknotes: data.countBanknotes,
        sumBanknotes: data.sumBanknotes,
        note: data.note.trim() || null,
      };
      if (isEdit) {
        await axios.patch(`/api/collections/${initialData!.id}`, payload);
      } else {
        await axios.post(`/api/collections`, payload);
      }
      router.push(`/collections`);
      router.refresh();
      toast.success(toastMessage);
    } catch (error) {
      const message =
        axios.isAxiosError(error) && typeof error.response?.data === "string"
          ? error.response.data
          : "Трапилась помилка.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    try {
      setLoading(true);
      await axios.delete(`/api/collections/${initialData!.id}`);
      router.push(`/collections`);
      router.refresh();
      toast.success("Інкасацію видалено.");
    } catch {
      toast.error("Трапилась помилка.");
    } finally {
      setOpen(false);
      setLoading(false);
    }
  };

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
        {isEdit ? (
          <Button
            disabled={loading}
            variant="destructive"
            size="icon"
            onClick={() => setOpen(true)}
          >
            <Trash className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <Separator />
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full space-y-8"
        >
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            <FormField
              control={form.control}
              name="deviceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Автомат</FormLabel>
                  <Select
                    disabled={loading}
                    onValueChange={field.onChange}
                    value={field.value || undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Оберіть автомат" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {machines.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {machineLabel(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>Технік</FormLabel>
              <Input
                disabled
                value={
                  selectedMachine
                    ? selectedMachine.technicianName ||
                      "Немає відповідального техніка"
                    : "Оберіть автомат"
                }
              />
              {selectedMachine && !selectedMachine.technicianId ? (
                <p className="text-sm text-destructive">
                  Закріпіть техніка за автоматом, щоб зберегти інкасацію.
                </p>
              ) : null}
            </FormItem>

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Дата</FormLabel>
                  <FormControl>
                    <Input type="date" disabled={loading} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Час</FormLabel>
                  <FormControl>
                    <Input type="time" disabled={loading} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="countCoins"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Кількість монет</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      disabled={loading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sumCoins"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Сума монет, грн</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      disabled={loading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="countBanknotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Кількість купюр</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      disabled={loading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sumBanknotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Сума купюр, грн</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      disabled={loading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>Загальна сума</FormLabel>
              <Input disabled value={`${moneyPreview(total)} грн`} />
            </FormItem>

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Коментар</FormLabel>
                  <FormControl>
                    <Input disabled={loading} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button disabled={loading} type="submit">
            {action}
          </Button>
        </form>
      </Form>
    </>
  );
};
