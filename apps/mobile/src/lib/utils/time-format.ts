/**
 * Shared time formatting utilities.
 */

/**
 * Format a Date to a short time string, e.g. "6:30 AM".
 */
export function formatTimeShort(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  const m = minutes === 0 ? "" : `:${String(minutes).padStart(2, "0")}`;
  return `${h}${m} ${ampm}`;
}

/**
 * Format a time range string, e.g. "6:30 AM - 10:20 AM".
 */
export function formatTimeRange(start: Date, end: Date): string {
  return `${formatTimeShort(start)} - ${formatTimeShort(end)}`;
}

/**
 * Format a duration in minutes to a human-readable string.
 * e.g. 50 -> "50 min", 90 -> "1h 30m", 120 -> "2h"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Get duration in minutes between two dates.
 */
export function getDurationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60000);
}
