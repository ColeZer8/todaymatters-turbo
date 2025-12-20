import type { TimeOfDayBucket } from './types';

export function getTimeOfDayBucket(hour24: number): TimeOfDayBucket {
  if (hour24 >= 5 && hour24 < 12) return 'morning';
  if (hour24 >= 12 && hour24 < 15) return 'midday';
  if (hour24 >= 15 && hour24 < 18) return 'afternoon';
  if (hour24 >= 18 && hour24 < 21) return 'evening';
  return 'night';
}

export function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function clampTextToMaxChars(text: string, maxChars: number): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(0, Math.max(0, maxChars - 1)).trimEnd() + '…';
}




