import { api, apiUrl, unwrap, type Schemas } from '@/lib/api/client';

export type Account = Schemas['Account'];
export type AccountInput = Schemas['AccountInput'];
export type ConnectionTestResult = Schemas['ConnectionTestResult'];
export type DiscoveryResult = Schemas['DiscoveryResult'];

export const accountKeys = {
  all: ['accounts'] as const,
  list: ['accounts', 'list'] as const,
  detail: (id: string) => ['accounts', 'detail', id] as const,
};

export async function fetchAccounts(): Promise<Account[]> {
  const data = unwrap(await api.GET('/accounts'));
  return data.accounts;
}

export async function fetchAccount(id: string): Promise<Account> {
  return unwrap(await api.GET('/accounts/{id}', { params: { path: { id } } }));
}

export async function createAccount(body: AccountInput): Promise<Account> {
  return unwrap(await api.POST('/accounts', { body }));
}

export async function discoverAccount(email: string): Promise<DiscoveryResult> {
  return unwrap(await api.POST('/accounts/discover', { body: { email } }));
}

export async function updateAccount(id: string, body: AccountInput): Promise<Account> {
  return unwrap(await api.PATCH('/accounts/{id}', { params: { path: { id } }, body }));
}

export async function deleteAccount(id: string): Promise<void> {
  const result = await api.DELETE('/accounts/{id}', { params: { path: { id } } });
  if (result.response.ok) return;
  unwrap(result);
}

export async function testAccount(id: string): Promise<ConnectionTestResult> {
  return unwrap(await api.POST('/accounts/{id}/test', { params: { path: { id } } }));
}

export async function requestAccountSync(id: string): Promise<void> {
  const result = await api.POST('/accounts/{id}/sync', { params: { path: { id } } });
  if (result.response.ok) return;
  unwrap(result);
}

export async function reconcileAccount(id: string): Promise<void> {
  const result = await api.POST('/accounts/{id}/reconcile', { params: { path: { id } } });
  if (result.response.ok) return;
  unwrap(result);
}

export function oauthStartUrl(provider: 'google' | 'microsoft', accountId?: string): string {
  const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
  return apiUrl(`/oauth/${provider}/start${query}`);
}
