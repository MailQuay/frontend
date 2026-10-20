import { api, unwrap, type Schemas } from '@/lib/api/client';

export type OutboxItem = Schemas['OutboxItem'];
export type SendRequest = Schemas['SendRequest'];

export const outboxKeys = {
  all: ['outbox'] as const,
  list: ['outbox', 'list'] as const,
};

export async function fetchOutbox(): Promise<OutboxItem[]> {
  const data = unwrap(await api.GET('/outbox'));
  return data.items;
}

export async function sendMessage(body: SendRequest): Promise<OutboxItem> {
  return unwrap(await api.POST('/messages/send', { body }));
}

export async function rescheduleOutbox(id: string, scheduledAt: string): Promise<OutboxItem> {
  return unwrap(
    await api.PATCH('/outbox/{id}', {
      params: { path: { id } },
      body: { scheduledAt },
    }),
  );
}

export async function retryOutbox(id: string): Promise<void> {
  const result = await api.POST('/outbox/{id}/retry', { params: { path: { id } } });
  if (result.response.ok) return;
  unwrap(result);
}

export async function cancelOutbox(id: string): Promise<void> {
  const result = await api.POST('/outbox/{id}/cancel', { params: { path: { id } } });
  if (result.response.ok) return;
  unwrap(result);
}
