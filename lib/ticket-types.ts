export type TicketMessage = {
  id: number;
  authorRole: string;
  authorName: string;
  body: string;
  createdAt: string;
  dateLabel: string;
  timeLabel: string;
};

export type TicketThread = {
  id: number;
  collectionId: number;
  handoverId: number | null;
  technicianId: number | null;
  technicianName: string;
  cashierId: number | null;
  cashierName: string;
  machine: string;
  expectedSum: number;
  actualReceived: number | null;
  status: "open" | "closed";
  createdByName: string;
  createdAt: string;
  dateLabel: string;
  timeLabel: string;
  closedAt: string | null;
  closedByName: string | null;
  messages: TicketMessage[];
};

export function ticketRoleLabel(role: string) {
  switch (role) {
    case "manager":
      return "Керівник";
    case "technician":
      return "Технік";
    case "cashier":
      return "Касир";
    case "cabinet":
      return "Кабінет";
    default:
      return role;
  }
}
