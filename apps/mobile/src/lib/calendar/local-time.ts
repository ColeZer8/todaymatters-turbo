function parseYmdParts(ymd: string): { year: number; month: number; day: number } | null {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;
  return { year, month, day };
}

export function ymdToLocalDayStart(ymd: string): Date {
  const parts = parseYmdParts(ymd);
  if (!parts) return new Date();
  return new Date(parts.year, parts.month, parts.day, 0, 0, 0, 0);
}

export function ymdMinutesToLocalDate(ymd: string, minutes: number): Date {
  const dayStart = ymdToLocalDayStart(ymd);
  const date = new Date(dayStart);
  date.setMinutes(date.getMinutes() + minutes);
  return date;
}

export function formatLocalIso(date: Date): string {
  const pad = (value: number, length = 2) => String(value).padStart(length, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const ms = pad(date.getMilliseconds(), 3);
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}`;
}
