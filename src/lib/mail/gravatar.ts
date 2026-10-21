const hashCache = new Map<string, Promise<string | null>>();

export function normalizeGravatarEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function sha256Hex(value: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function gravatarHash(email: string): Promise<string | null> {
  const normalized = normalizeGravatarEmail(email);
  if (!normalized) return Promise.resolve(null);

  const cached = hashCache.get(normalized);
  if (cached) return cached;

  const pending = sha256Hex(normalized)
    .then((hash) => {
      if (!hash) hashCache.delete(normalized);
      return hash;
    })
    .catch(() => {
      hashCache.delete(normalized);
      return null;
    });
  hashCache.set(normalized, pending);
  return pending;
}

export async function gravatarUrl(email: string, size = 80): Promise<string | null> {
  const hash = await gravatarHash(email);
  if (!hash) return null;

  const params = new URLSearchParams({ d: '404', r: 'g', s: String(size) });
  return `https://gravatar.com/avatar/${hash}?${params.toString()}`;
}
