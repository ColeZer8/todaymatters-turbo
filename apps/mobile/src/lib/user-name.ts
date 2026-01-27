export function getFirstName(
  fullName: string | null | undefined,
): string | null {
  const trimmed = fullName?.trim();
  if (!trimmed) return null;
  const first = trimmed.split(/\s+/)[0]?.trim();
  return first ? first : null;
}

export function deriveFullNameFromEmail(
  email: string | null | undefined,
): string | null {
  const trimmed = email?.trim();
  if (!trimmed) return null;
  const local = trimmed.split("@")[0]?.trim();
  if (!local) return null;
  // "john.doe" -> "John Doe"
  const parts = local
    .split(/[._-]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const titled = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
  return titled.trim() || null;
}
