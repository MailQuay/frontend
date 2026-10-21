import { apiUrl } from '@/lib/api/client';

export function senderDomain(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at < 0) return null;

  const domain = normalized.slice(at + 1);
  if (
    !domain ||
    !domain.includes('.') ||
    domain.startsWith('.') ||
    domain.endsWith('.') ||
    domain.includes('..') ||
    !/^[a-z0-9.-]+$/.test(domain)
  ) {
    return null;
  }
  return domain;
}

export function senderFaviconUrl(email: string): string | null {
  const domain = senderDomain(email);
  if (!domain) return null;
  return apiUrl(`/favicon?domain=${encodeURIComponent(domain)}`);
}
