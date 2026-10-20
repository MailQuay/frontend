import { api, unwrap, type Schemas } from '@/lib/api/client';

export type Identity = Schemas['Identity'];
export type IdentityInput = Schemas['IdentityInput'];

export const identityKeys = {
  all: ['identities'] as const,
  list: (accountId: string) => ['identities', accountId] as const,
};

export async function fetchIdentities(accountId: string): Promise<Identity[]> {
  const data = unwrap(
    await api.GET('/accounts/{id}/identities', { params: { path: { id: accountId } } }),
  );
  return data.identities;
}

export async function createIdentity(
  accountId: string,
  body: IdentityInput,
): Promise<Identity> {
  return unwrap(
    await api.POST('/accounts/{id}/identities', {
      params: { path: { id: accountId } },
      body,
    }),
  );
}

export async function updateIdentity(
  accountId: string,
  email: string,
  body: IdentityInput,
): Promise<Identity> {
  return unwrap(
    await api.PATCH('/accounts/{id}/identities/{email}', {
      params: { path: { id: accountId, email } },
      body,
    }),
  );
}

export async function deleteIdentity(accountId: string, email: string): Promise<void> {
  const result = await api.DELETE('/accounts/{id}/identities/{email}', {
    params: { path: { id: accountId, email } },
  });
  if (result.response.ok) return;
  unwrap(result);
}

export async function setDefaultIdentity(accountId: string, email: string): Promise<void> {
  const result = await api.POST('/accounts/{id}/identities/{email}/default', {
    params: { path: { id: accountId, email } },
  });
  if (result.response.ok) return;
  unwrap(result);
}
