import axios from "axios";

import prismadb from "@/lib/prismadb";

const SOLITON_DEVICES_URL = "http://soliton.net.ua/water/api/devices";

export type SolitonDevice = {
  id: string;
  name: string;
  lat: string | null;
  lon: string | null;
};

/** Прибирає суфікс на кшталт «Близенько 2.50 грн» з назви Soliton */
export function locationFromSolitonName(name: string): string {
  return name
    .replace(/\s*Близенько\s*[\d.,]+\s*грн\.?\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchSolitonDevices(): Promise<SolitonDevice[]> {
  const { data } = await axios.get(SOLITON_DEVICES_URL, { timeout: 20000 });
  const list: unknown[] = Array.isArray(data?.devices) ? data.devices : [];
  return list
    .filter(
      (d: unknown): d is SolitonDevice =>
        !!d &&
        typeof d === "object" &&
        typeof (d as SolitonDevice).id === "string" &&
        typeof (d as SolitonDevice).name === "string"
    )
    .map((d: SolitonDevice) => ({
      id: d.id,
      name: d.name,
      lat: d.lat ?? null,
      lon: d.lon ?? null,
    }));
}

/**
 * Upsert пристроїв Soliton:
 * - location + lat/lon з API (стандартна локація)
 * - name не чіпаємо (кастомна назва вводиться в кабінеті)
 */
export async function syncMachinesFromSoliton() {
  const devices = await fetchSolitonDevices();
  let created = 0;
  let updated = 0;

  for (const device of devices) {
    const id = parseInt(device.id, 10);
    if (!Number.isFinite(id)) continue;

    const location = locationFromSolitonName(device.name) || device.name;
    const existing = await prismadb.vending_machines.findUnique({
      where: { id },
    });

    if (!existing) {
      await prismadb.vending_machines.create({
        data: {
          id,
          name: null,
          address: null,
          location,
          lat: device.lat,
          lon: device.lon,
          updatedAt: new Date(),
        },
      });
      created += 1;
      continue;
    }

    // Якщо name дублює Soliton/локацію — скидаємо, щоб можна було задати свою назву
    const nameLooksLikeLocation =
      !!existing.name &&
      (existing.name === existing.location ||
        existing.name === existing.address ||
        /Близенько/i.test(existing.name) ||
        existing.name === location ||
        existing.name === device.name);

    await prismadb.vending_machines.update({
      where: { id },
      data: {
        location,
        lat: device.lat,
        lon: device.lon,
        address: null,
        ...(nameLooksLikeLocation ? { name: null } : {}),
        updatedAt: new Date(),
      },
    });
    updated += 1;
  }

  return { total: devices.length, created, updated };
}
