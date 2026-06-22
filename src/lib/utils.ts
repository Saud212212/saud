import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "USD", locale = "en-US") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}

export function formatDate(date: string | Date, locale = "en-US") {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}
