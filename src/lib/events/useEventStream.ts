import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiUrl } from '@/lib/api/client';

const EVENT_NAMES = [
  'hello',
  'message.new',
  'message.updated',
  'message.removed',
  'mailbox.updated',
  'account.updated',
  'outbox.updated',
  'task.updated',
  'task.removed',
] as const;

type EventName = (typeof EVENT_NAMES)[number];

const INVALIDATION_BY_EVENT: Record<EventName, string[][]> = {
  hello: [],
  'message.new': [['messages'], ['mailboxes']],
  'message.updated': [['messages'], ['mailboxes']],
  'message.removed': [['messages'], ['mailboxes']],
  'mailbox.updated': [['mailboxes']],
  'account.updated': [['accounts'], ['mailboxes']],
  'outbox.updated': [['outbox'], ['drafts'], ['messages']],
  'task.updated': [['tasks']],
  'task.removed': [['tasks']],
};

/**
 * One SSE connection per document. Events invalidate server-state caches;
 * they never copy message payloads into client state.
 */
export function useEventStream(enabled = true): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    let source: EventSource | null = null;
    let disposed = false;
    let attempts = 0;
    let reconnectTimer: number | undefined;

    const handle = (event: MessageEvent) => {
      const keys = INVALIDATION_BY_EVENT[event.type as EventName];
      if (!keys) return;
      for (const key of keys) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    };

    const connect = () => {
      if (disposed) return;
      source = new EventSource(apiUrl('/events'), { withCredentials: true });
      source.onopen = () => {
        attempts = 0;
      };
      for (const name of EVENT_NAMES) {
        source.addEventListener(name, handle as EventListener);
      }
      source.onerror = () => {
        source?.close();
        source = null;
        if (disposed) return;
        attempts += 1;
        const delay = Math.min(30_000, 1_000 * 2 ** Math.min(attempts, 5));
        reconnectTimer = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      if (source) {
        for (const name of EVENT_NAMES) {
          source.removeEventListener(name, handle as EventListener);
        }
        source.close();
      }
    };
  }, [enabled, queryClient]);
}
