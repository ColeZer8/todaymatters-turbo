export function hashString(input: string): string {
  // djb2
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  // Force unsigned and compact base36
  return (hash >>> 0).toString(36);
}

export function stableHashJson(value: unknown): string {
  return hashString(stableStringify(value));
}

function stableStringify(value: unknown): string {
  if (value == null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);

  if (Array.isArray(value)) {
    return '[' + value.map((v) => stableStringify(v)).join(',') + ']';
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    '{' +
    keys
      .map((k) => {
        const v = obj[k];
        return JSON.stringify(k) + ':' + stableStringify(v);
      })
      .join(',') +
    '}'
  );
}

