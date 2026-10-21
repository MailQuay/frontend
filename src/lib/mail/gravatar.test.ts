import { describe, expect, it } from 'vitest';
import { gravatarHash, gravatarUrl, normalizeGravatarEmail } from './gravatar';

describe('gravatar', () => {
  it('normalizes sender addresses before hashing', () => {
    expect(normalizeGravatarEmail('  MyEmailAddress@Example.com  ')).toBe(
      'myemailaddress@example.com',
    );
  });

  it('hashes the normalized address with SHA-256', async () => {
    expect(await gravatarHash('  MyEmailAddress@Example.com  ')).toBe(
      '84059b07d4be67b806386c0aad8070a23f18836bbaae342275dc0a83414c32ee',
    );
  });

  it('requests a sized avatar with a 404 fallback', async () => {
    expect(await gravatarUrl('  MyEmailAddress@Example.com  ', 64)).toBe(
      'https://gravatar.com/avatar/84059b07d4be67b806386c0aad8070a23f18836bbaae342275dc0a83414c32ee?d=404&r=g&s=64',
    );
  });

  it('returns no hash or URL for an empty address', async () => {
    expect(await gravatarHash('   ')).toBeNull();
    expect(await gravatarUrl('')).toBeNull();
  });
});
