"use client";

import { Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";

export const MailingClient = ({}) => {
  const params = useParams();
  const router = useRouter();

  return (
    <>
      <div className="flex items-center justify-between">
        <Heading
          title={`Завдання ()`}
          description="Редагування і відслідковування задач"
        />
        <Button onClick={() => router.push(`/${params.storeId}/`)}>
          <Plus className="mr-2 h-4 w-4" /> Додати нову розсилку
        </Button>
      </div>
      <Separator />
    </>
  );
};
