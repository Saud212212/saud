import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * دمج أصناف Tailwind بأمان مع حل التعارضات.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
