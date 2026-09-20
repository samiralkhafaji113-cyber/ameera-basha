/**
 * Reservation lifecycle. The database enforces the same transitions with a trigger (`app.reservation_transition_ok`);
 * this copy only decides which buttons the admin UI offers. Keep both in sync (covered by tests/integration).
 */
export const RESERVATION_STATUSES = ["pending", "contacted", "confirmed", "cancelled", "completed", "rejected"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  pending: "جديد",
  contacted: "تم التواصل",
  confirmed: "مؤكد",
  cancelled: "ملغي",
  completed: "مكتمل",
  rejected: "مرفوض",
};

export const STATUS_TONE: Record<ReservationStatus, "warning" | "neutral" | "gold" | "success" | "error" | "dark"> = {
  pending: "warning",
  contacted: "gold",
  confirmed: "dark",
  completed: "success",
  cancelled: "neutral",
  rejected: "error",
};

const TRANSITIONS: Record<ReservationStatus, readonly ReservationStatus[]> = {
  pending: ["contacted", "confirmed", "cancelled", "rejected"],
  contacted: ["confirmed", "cancelled", "rejected"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: ["pending"], // re-open
  rejected: ["pending"],
};

export const nextStatuses = (from: ReservationStatus): readonly ReservationStatus[] => TRANSITIONS[from];
export const canTransition = (from: ReservationStatus, to: ReservationStatus) => from === to || TRANSITIONS[from].includes(to);
export const isReservationStatus = (v: unknown): v is ReservationStatus => typeof v === "string" && (RESERVATION_STATUSES as readonly string[]).includes(v);

/** Button labels for a move (verb, not the resulting state). */
export const ACTION_LABEL: Record<ReservationStatus, string> = {
  pending: "إعادة فتح الحجز",
  contacted: "تم التواصل",
  confirmed: "تأكيد الحجز",
  cancelled: "إلغاء الحجز",
  completed: "إتمام الحجز",
  rejected: "رفض الحجز",
};

/** Active = still needs work from the store. Drives the dashboard counters and the "new reservations" banner. */
export const ACTIVE_STATUSES: readonly ReservationStatus[] = ["pending", "contacted", "confirmed"];

/**
 * Reservation search input → a safe fragment for PostgREST's `.or()` filter. Commas, parentheses, quotes and the
 * `*`/`%`/`_` wildcards would let a user inject extra filter clauses or change matching, so they are removed.
 */
export function sanitizeSearchTerm(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[,()"'\\%_*:;<>{}[\]|&=]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}
