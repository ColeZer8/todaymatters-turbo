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


