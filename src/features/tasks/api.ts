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

export async function deleteTask(id: string): Promise<void> {
  const result = await api.DELETE('/tasks/{id}', { params: { path: { id } } });
  if (result.response.ok) return;
  unwrap(result);
}

export async function deleteTasksByType(types: string[], accountId?: string): Promise<void> {
  const result = await api.DELETE('/tasks', {
    params: { query: { type: types, accountId } },
  });
  if (result.response.ok) return;
  unwrap(result);
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
