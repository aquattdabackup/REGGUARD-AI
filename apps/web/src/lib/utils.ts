import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const date = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not available";
export const short = (value?: string | null) =>
  value ? `${value.slice(0, 8)}...${value.slice(-6)}` : "Not recorded";
