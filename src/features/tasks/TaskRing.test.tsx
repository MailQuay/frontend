import '@/lib/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Task } from './api';
import { TaskRing } from './TaskRing';

function makeTask(overrides: Partial<Task> & Pick<Task, 'id' | 'type' | 'status'>): Task {
  return {
    done: 0,
    total: 0,
    unit: 'messages',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderRing(tasks: Task[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TaskRing tasks={tasks} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TaskRing', () => {
  it('renders an idle white ring when there is no work', () => {
    renderRing([]);
    const progress = screen.getByRole('progressbar');
    expect(progress).toHaveAttribute('aria-valuenow', '0');
    expect(progress).toHaveAttribute('aria-label', 'No background tasks');
  });

  it('exposes aggregate progress on the ring', () => {
    renderRing([
      makeTask({ id: 'a', type: 'mailbox_sync', status: 'running', done: 25, total: 100 }),
      makeTask({ id: 'b', type: 'body_fetch', status: 'pending', total: 100 }),
    ]);
    const progress = screen.getByRole('progressbar');
    expect(progress).toHaveAttribute('aria-valuenow', '13');
    expect(progress).toHaveAttribute('aria-label', 'Background task progress 13 percent');
  });

  it('opens the panel on hover and closes it with Escape', async () => {
    const user = userEvent.setup();
    renderRing([
      makeTask({ id: 'a', type: 'mailbox_sync', status: 'running', done: 10, total: 20 }),
    ]);
    const trigger = screen.getByRole('button', { name: /background task progress/i });
    await user.hover(trigger);
    expect(await screen.findByText('Mailbox sync')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByText('Tasks')).not.toBeInTheDocument();
    });
  });

  it('opens the panel from the keyboard', async () => {
    renderRing([
      makeTask({ id: 'a', type: 'search_index', status: 'running', done: 5, total: 10 }),
    ]);
    const trigger = screen.getByRole('button', { name: /background task progress/i });
    trigger.focus();
    expect(await screen.findByText('Search index')).toBeInTheDocument();
  });

  it('shows failed tasks with their error and dismiss action', async () => {
    const user = userEvent.setup();
    renderRing([
      makeTask({
        id: 'failed',
        type: 'search_index',
        status: 'failed',
        done: 1,
        total: 2,
        error: 'index unavailable',
      }),
    ]);
    const trigger = screen.getByRole('button', { name: /background task progress/i });
    await user.hover(trigger);
    expect(await screen.findByText('index unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('removes completed tasks from the ring after two seconds', async () => {
    renderRing([
      makeTask({ id: 'done', type: 'mailbox_sync', status: 'completed', done: 10, total: 10 }),
    ]);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    await waitFor(
      () => {
        expect(screen.getByRole('progressbar')).toHaveAttribute(
          'aria-label',
          'No background tasks',
        );
      },
      { timeout: 3000 },
    );
  });
});
