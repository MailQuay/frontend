import { api, unwrap, type Schemas } from '@/lib/api/client';

export type Task = Schemas['Task'];

export const taskKeys = {
  all: ['tasks'] as const,
  list: ['tasks', 'list'] as const,
};

export async function fetchTasks(): Promise<Task[]> {
  const data = unwrap(await api.GET('/tasks'));
  return data.tasks;
}

export async function dismissTask(id: string): Promise<void> {
  const result = await api.POST('/tasks/{id}/dismiss', { params: { path: { id } } });
  if (result.response.ok) return;
  unwrap(result);
}

export async function retryTask(id: string): Promise<void> {
  const result = await api.POST('/tasks/{id}/retry', { params: { path: { id } } });
  if (result.response.ok) return;
  unwrap(result);
}
