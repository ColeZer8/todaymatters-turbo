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
  // Fixed: Use proper UTC ISO format instead of lying about timezone
  // Previously extracted LOCAL time components then claimed they were UTC (+00:00)
  // This caused query windows to be shifted by the timezone offset (e.g., 6 hours for Chicago)
  return date.toISOString();
}
