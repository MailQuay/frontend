import { describe, expect, it } from 'vitest';
import { senderDomain, senderFaviconUrl } from './favicon';

describe('sender favicon', () => {
  it('extracts the domain from the sender address', () => {
    expect(senderDomain('notifications@github.com')).toBe('github.com');
    expect(senderDomain('  USER@Example.COM  ')).toBe('example.com');
  });

  it('rejects addresses without a usable domain', () => {
    expect(senderDomain('not-an-email')).toBeNull();
    expect(senderDomain('user@localhost')).toBeNull();
    expect(senderDomain('user@')).toBeNull();
  });

  it('builds the proxied favicon URL from the sender domain', () => {
    expect(senderFaviconUrl('notifications@github.com')).toBe('/api/v1/favicon?domain=github.com');
    expect(senderFaviconUrl('not-an-email')).toBeNull();
  });
});
