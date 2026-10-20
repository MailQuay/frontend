import { useQuery } from '@tanstack/react-query';
import { fetchAccounts, type Account } from '@/features/accounts/api';
import { fetchIdentities, type Identity } from '@/features/identities/api';

export interface IdentityGroup {
  account: Account;
  identities: Identity[];
}

export const allIdentityKeys = {
  all: ['identities', 'all'] as const,
};

export function useAllIdentities() {
  return useQuery({
    queryKey: allIdentityKeys.all,
    queryFn: async (): Promise<IdentityGroup[]> => {
      const accounts = await fetchAccounts();
      return Promise.all(
        accounts.map(async (account) => ({
          account,
          identities: await fetchIdentities(account.id),
        })),
      );
    },
    staleTime: 60_000,
  });
}

export function flattenIdentities(groups: IdentityGroup[] | undefined): Identity[] {
  return (groups ?? []).flatMap((group) => group.identities);
}

export function syntheticIdentity(accountId: string, email: string): Identity {
  return {
    accountId,
    email,
    name: '',
    signatureMode: 'none',
    isDefault: false,
  };
}

export function resolveDefaultIdentity(
  groups: IdentityGroup[] | undefined,
  preferredAccountId?: string,
): Identity | undefined {
  if (!groups || groups.length === 0) return undefined;
  const ordered = preferredAccountId
    ? [
        ...groups.filter((group) => group.account.id === preferredAccountId),
        ...groups.filter((group) => group.account.id !== preferredAccountId),
      ]
    : groups;
  for (const group of ordered) {
    const candidate = group.identities.find((identity) => identity.isDefault) ?? group.identities[0];
    if (candidate) return candidate;
  }
  return undefined;
}

const LAST_IDENTITY_KEY = 'mailquay:last-identity';

export interface StoredIdentity {
  accountId: string;
  email: string;
}

export function rememberIdentity(identity: Identity): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    LAST_IDENTITY_KEY,
    JSON.stringify({ accountId: identity.accountId, email: identity.email }),
  );
}

export function recallIdentity(groups: IdentityGroup[] | undefined): Identity | undefined {
  if (!groups || typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(LAST_IDENTITY_KEY);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('accountId' in parsed) ||
      !('email' in parsed)
    ) {
      return undefined;
    }
    const accountId = parsed.accountId;
    const email = parsed.email;
    if (typeof accountId !== 'string' || typeof email !== 'string') return undefined;
    return flattenIdentities(groups).find(
      (identity) => identity.accountId === accountId && identity.email === email,
    );
  } catch {
    return undefined;
  }
}

export function identityApplies(
  mode: Identity['signatureMode'],
  composeMode: 'new' | 'reply' | 'replyAll' | 'forward',
): boolean {
  if (mode === 'all') return true;
  if (mode === 'none') return false;
  if (mode === 'new') return composeMode === 'new';
  if (mode === 'reply') return composeMode === 'reply' || composeMode === 'replyAll';
  return composeMode === 'forward';
}
