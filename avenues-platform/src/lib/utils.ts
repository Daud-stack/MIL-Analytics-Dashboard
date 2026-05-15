import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { MONTHS } from "@/types";

/**
 * Merge Tailwind CSS classes with clsx for conditional classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as currency
 */
export function formatCurrency(
  value: number,
  currency: string = "USD",
  locale: string = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a number with thousands separator
 */
export function formatNumber(value: number, decimalPlaces: number = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(value);
}

/**
 * Format a number as percentage
 */
export function formatPercent(
  value: number,
  decimalPlaces: number = 1,
  includeSign: boolean = false
): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(value);

  const sign = includeSign && value > 0 ? "+" : "";
  return `${sign}${formatted}%`;
}

/**
 * Calculate year-over-year change
 */
export function calculateYoY(
  current: number,
  previous: number
): { change: number; percent: number; type: "increase" | "decrease" | "neutral" } {
  if (previous === 0) {
    return {
      change: current,
      percent: current > 0 ? 100 : 0,
      type: current > 0 ? "increase" : current < 0 ? "decrease" : "neutral",
    };
  }

  const change = current - previous;
  const percent = (change / Math.abs(previous)) * 100;
  const type = change > 0 ? "increase" : change < 0 ? "decrease" : "neutral";

  return { change, percent, type };
}

/**
 * Get month name from 0-indexed month number
 */
export function getMonthName(monthIndex: number): string {
  if (monthIndex < 0 || monthIndex >= MONTHS.length) {
    return "Invalid Month";
  }
  return MONTHS[monthIndex];
}

/**
 * Get short month name (e.g., "Jan")
 */
export function getMonthShortName(monthIndex: number): string {
  return getMonthName(monthIndex).substring(0, 3);
}

/**
 * Format date to readable string
 */
export function formatDate(
  date: Date | string,
  format: "short" | "long" | "full" = "short"
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  const options: Intl.DateTimeFormatOptions =
    format === "short"
      ? { year: "2-digit", month: "short", day: "numeric" }
      : format === "long"
        ? { year: "numeric", month: "long", day: "numeric" }
        : { weekday: "long", year: "numeric", month: "long", day: "numeric" };

  return dateObj.toLocaleDateString("en-US", options);
}

/**
 * Format time to HH:MM:SS
 */
export function formatTime(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Generate CSV content from data
 */
export function generateCSV(
  data: Record<string, unknown>[],
  headers?: string[]
): string {
  if (data.length === 0) return "";

  // Use provided headers or extract from first object
  const csvHeaders = headers || Object.keys(data[0] as Record<string, unknown>);

  // Create header row
  const headerRow = csvHeaders
    .map((h) => {
      // Escape quotes and wrap in quotes if contains comma or newline
      const escaped = String(h).replace(/"/g, '""');
      return escaped.includes(",") || escaped.includes("\n")
        ? `"${escaped}"`
        : escaped;
    })
    .join(",");

  // Create data rows
  const dataRows = data.map((row) =>
    csvHeaders
      .map((header) => {
        const value = row[header as keyof typeof row];

        // Handle null/undefined
        if (value === null || value === undefined) {
          return "";
        }

        // Convert to string
        const stringValue = String(value);

        // Escape quotes and wrap in quotes if contains comma or newline
        const escaped = stringValue.replace(/"/g, '""');
        return escaped.includes(",") ||
          escaped.includes("\n") ||
          escaped.includes('"')
          ? `"${escaped}"`
          : escaped;
      })
      .join(",")
  );

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Download CSV file
 */
export function downloadCSV(csv: string, filename: string = "export.csv"): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.substring(0, length) + "...";
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Check if value is empty
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as T;
  if (obj instanceof Array) {
    const cloneArr: unknown[] = [];
    for (let i = 0; i < obj.length; i++) {
      cloneArr[i] = deepClone(obj[i]);
    }
    return cloneArr as T;
  }
  if (obj instanceof Object) {
    const cloneObj: Record<string, unknown> = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloneObj[key] = deepClone(obj[key as keyof T]);
      }
    }
    return cloneObj as T;
  }
  return obj;
}

/**
 * Parse JSON safely
 */
export function parseJSON<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Round number to decimal places
 */
export function round(value: number, decimalPlaces: number = 2): number {
  return Math.round(value * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces);
}

/**
 * Calculate percentage change
 */
export function percentChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Sum array of numbers
 */
export function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

/**
 * Calculate average of array
 */
export function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return sum(arr) / arr.length;
}

/**
 * Get min value from array
 */
export function getMin(arr: number[]): number {
  return Math.min(...arr);
}

/**
 * Get max value from array
 */
export function getMax(arr: number[]): number {
  return Math.max(...arr);
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate unique ID
 */
export function generateId(prefix: string = ""): string {
  return `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Format bytes to human readable size
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
