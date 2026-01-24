export function getDisplayNameFromFromAddress(fromAddress: string | null): string {
  if (!fromAddress) return 'Unknown';

  // Common formats:
  // - "Jane Doe <jane@acme.com>"
  // - "jane@acme.com"
  const trimmed = fromAddress.trim();
  const angleStart = trimmed.indexOf('<');
  if (angleStart > 0) {
    const name = trimmed.slice(0, angleStart).trim().replace(/^"(.+)"$/, '$1');
    if (name) return name;
  }

  // Fall back to the email local-part if it looks like an email.
  const at = trimmed.indexOf('@');
  if (at > 0) return trimmed.slice(0, at);

  return trimmed;
}

export function getGmailHeaderValue(meta: unknown, headerName: string): string | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const raw = (meta as Record<string, unknown>).raw;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const normalized = headerName.trim().toLowerCase();

  const searchHeaders = (headers: unknown): string | null => {
    if (!Array.isArray(headers)) return null;
    for (const entry of headers) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const name = (entry as Record<string, unknown>).name;
      const value = (entry as Record<string, unknown>).value;
      if (typeof name === 'string' && typeof value === 'string' && name.trim().toLowerCase() === normalized) {
        return value.trim();
      }
    }
    return null;
  };

  const rawRecord = raw as Record<string, unknown>;
  const direct = rawRecord[normalized];
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const payload = rawRecord.payload as Record<string, unknown> | undefined;
  const fromPayload = searchHeaders(payload?.headers);
  if (fromPayload) return fromPayload;

  const headers = rawRecord.headers;
  return searchHeaders(headers);
}

export function getGmailFromAddress(meta: unknown): string | null {
  const fromValue = getGmailHeaderValue(meta, 'From');
  if (fromValue) return fromValue;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const raw = (meta as Record<string, unknown>).raw;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const fallback = (raw as Record<string, unknown>).from;
  return typeof fallback === 'string' ? fallback : null;
}

export function getGmailSubject(meta: unknown): string | null {
  return getGmailHeaderValue(meta, 'Subject');
}

export function getInitialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();

  const first = parts[0].slice(0, 1).toUpperCase();
  const last = parts[parts.length - 1].slice(0, 1).toUpperCase();
  return `${first}${last}`;
}

export function formatCommunicationTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const now = new Date();

  const isSameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (isSameDay) {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  if (isYesterday) return 'Yesterday';

  return new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    day: 'numeric',
  }).format(d);
}

export function formatCommunicationTimestamp(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}


