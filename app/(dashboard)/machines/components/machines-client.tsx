"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type MachineRow = {
  id: number;
  name: string | null;
  location: string;
  technicianId: number | null;
  technicianName: string | null;
  status: string | null;
};

export type TechnicianOption = {
  id: number;
  name: string;
};

export function MachinesClient({
  machines,
  technicians,
}: {
  machines: MachineRow[];
  technicians: TechnicianOption[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | "new" | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [filterTech, setFilterTech] = useState("all");
  const [draftId, setDraftId] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftLocation, setDraftLocation] = useState("");
  const [draftTech, setDraftTech] = useState("none");
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState({
    name: "",
    location: "",
    technicianId: "none",
  });

  const filteredMachines = useMemo(() => {
    if (filterTech === "all") return machines;
    if (filterTech === "none") {
      return machines.filter((m) => m.technicianId === null);
    }
    const id = parseInt(filterTech, 10);
    return machines.filter((m) => m.technicianId === id);
  }, [machines, filterTech]);

  const onSync = async () => {
    try {
      setSyncing(true);
      const { data } = await axios.post("/api/machines/sync");
      toast.success(
        `Soliton: ${data.total} · нових ${data.created} · оновлено ${data.updated}`
      );
      router.refresh();
    } catch {
      toast.error("Не вдалося синхронізувати з Soliton");
    } finally {
      setSyncing(false);
    }
  };

  const startEdit = (m: MachineRow) => {
    setEditId(m.id);
    setEdit({
      name: m.name || "",
      location: m.location || "",
      technicianId: m.technicianId ? String(m.technicianId) : "none",
    });
  };

  const onCreate = async () => {
    if (!draftLocation.trim()) {
      toast.error("Вкажіть локацію");
      return;
    }
    try {
      setBusyId("new");
      await axios.post("/api/machines", {
        id: draftId.trim() || undefined,
        name: draftName.trim() || null,
        location: draftLocation.trim(),
        technicianId: draftTech === "none" ? null : draftTech,
      });
      setDraftId("");
      setDraftName("");
      setDraftLocation("");
      setDraftTech("none");
      toast.success("Автомат додано");
      router.refresh();
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        toast.error("Такий номер автомата вже є");
      } else {
        toast.error("Не вдалося створити");
      }
    } finally {
      setBusyId(null);
    }
  };

  const onSave = async (id: number) => {
    if (!edit.location.trim()) {
      toast.error("Вкажіть локацію");
      return;
    }
    try {
      setBusyId(id);
      await axios.patch(`/api/machines/${id}`, {
        name: edit.name.trim() || null,
        location: edit.location.trim(),
        technicianId: edit.technicianId === "none" ? null : edit.technicianId,
      });
      setEditId(null);
      toast.success("Збережено");
      router.refresh();
    } catch {
      toast.error("Не вдалося зберегти");
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (id: number) => {
    try {
      setBusyId(id);
      await axios.delete(`/api/machines/${id}`);
      toast.success("Видалено");
      router.refresh();
    } catch {
      toast.error("Не вдалося видалити");
    } finally {
      setBusyId(null);
    }
  };

  const statusBadge = (status: string | null) => {
    if (status === "operational") {
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">ok</Badge>;
    }
    if (status === "maintenance") {
      return <Badge variant="secondary">maintenance</Badge>;
    }
    if (status === "out_of_service") {
      return <Badge variant="destructive">offline</Badge>;
    }
    return <Badge variant="outline">{status || "—"}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          disabled={syncing || busyId !== null}
          onClick={onSync}
        >
          {syncing ? "Синхронізація…" : "Оновити з Soliton"}
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            Фільтр техніка
          </span>
          <Select value={filterTech} onValueChange={setFilterTech}>
            <SelectTrigger className="w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Усі автомати</SelectItem>
              <SelectItem value="none">Без техніка</SelectItem>
              {technicians.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-sm text-muted-foreground">
          Показано {filteredMachines.length} з {machines.length}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">№ автомата</label>
          <Input
            value={draftId}
            onChange={(e) => setDraftId(e.target.value)}
            placeholder="напр. 153"
            inputMode="numeric"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Назва</label>
          <Input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Ваша назва"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Локація</label>
          <Input
            value={draftLocation}
            onChange={(e) => setDraftLocation(e.target.value)}
            placeholder="Вулиця / місце"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Технік</label>
          <Select
            value={draftTech}
            onValueChange={setDraftTech}
            disabled={technicians.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  technicians.length === 0
                    ? "Немає техніків у налаштуваннях"
                    : "Технік"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Не призначено</SelectItem>
              {technicians.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={onCreate} disabled={busyId === "new"}>
        Додати автомат
      </Button>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>№</TableHead>
              <TableHead>Назва</TableHead>
              <TableHead>Локація</TableHead>
              <TableHead>Технік</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Дії</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMachines.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  {machines.length === 0
                    ? "Немає автоматів у реєстрі"
                    : "Немає автоматів за цим фільтром"}
                </TableCell>
              </TableRow>
            ) : (
              filteredMachines.map((m) => {
                const busy = busyId === m.id;
                const editing = editId === m.id;

                if (editing) {
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.id}</TableCell>
                      <TableCell>
                        <Input
                          value={edit.name}
                          placeholder="Ваша назва"
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, name: e.target.value }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={edit.location}
                          onChange={(e) =>
                            setEdit((s) => ({
                              ...s,
                              location: e.target.value,
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="min-w-[180px]">
                        <Select
                          value={edit.technicianId}
                          onValueChange={(v) =>
                            setEdit((s) => ({ ...s, technicianId: v }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Не призначено</SelectItem>
                            {technicians.map((t) => (
                              <SelectItem key={t.id} value={String(t.id)}>
                                {t.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{statusBadge(m.status)}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => onSave(m.id)}
                        >
                          Зберегти
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => setEditId(null)}
                        >
                          Скасувати
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                }

                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.id}</TableCell>
                    <TableCell>{m.name || "—"}</TableCell>
                    <TableCell>{m.location || "—"}</TableCell>
                    <TableCell>{m.technicianName || "—"}</TableCell>
                    <TableCell>{statusBadge(m.status)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => startEdit(m)}
                      >
                        Редагувати
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => onDelete(m.id)}
                      >
                        Видалити
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
