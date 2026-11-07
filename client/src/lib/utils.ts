import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" for an <input type="date"> from the LOCAL calendar day (today by default). */
export function localDateInput(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "YYYY-MM-DDTHH:mm" for an <input type="datetime-local"> in local time (now by default). */
export function localDateTimeInput(date: Date = new Date()): string {
  return `${localDateInput(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Server dates (the server runs in UTC; date-only values are UTC midnight) → "YYYY-MM-DD" for a date input.
 * Uses the UTC day, which is the day the user picked.
 */
export function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** Server date → "dd/mm/aaaa" (pt-PT), using the UTC day for date-only values. */
export function formatDate(value: string | Date | null | undefined, fallback = "Não definido"): string {
  if (!value) return fallback;
  const d = new Date(value);
  return isNaN(d.getTime()) ? fallback : d.toLocaleDateString("pt-PT", { timeZone: "UTC" });
}

/** "1 234,56 €" */
export function formatEuro(value: number | string | null | undefined): string {
  return Number(value ?? 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

/** "12 345" */
export function formatNumber(value: number | string | null | undefined, digits = 0): string {
  return Number(value ?? 0).toLocaleString("pt-PT", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

/** Days from today (local) until the given server date; negative if past. */
export function daysUntil(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const target = new Date(toDateInput(value) + "T00:00:00");
  const today = new Date(localDateInput() + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
