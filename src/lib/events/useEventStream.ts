import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiUrl } from '@/lib/api/client';
import { parseEventPayload, publishMailEvent } from './bus';

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
  // New messages are inserted by the active list, which honours the
  // prependNewMessages preference. Only the counts refresh globally.
  'message.new': [['mailboxes']],
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
 * they never copy message payloads into client state. Message events are also
 * forwarded to mounted views through the in-document bus.
 */
export function useEventStream(enabled = true): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    let source: EventSource | null = null;
    let disposed = false;
    let attempts = 0;
    let lastEventId = '';
    let reconnectTimer: number | undefined;
    let taskTimer: number | undefined;

    const handle = (event: MessageEvent) => {
      if (event.lastEventId) lastEventId = event.lastEventId;
      const keys = INVALIDATION_BY_EVENT[event.type as EventName];
      if (!keys) return;
      if (event.type.startsWith('message.')) {
        publishMailEvent(event.type, parseEventPayload(event.data));
      }
      for (const key of keys) {
        if (key.length === 1 && key[0] === 'tasks') {
          // Progress updates can arrive in bursts; coalesce them so the ring
          // redraws at most a few times per second instead of per event.
          if (taskTimer !== undefined) window.clearTimeout(taskTimer);
          taskTimer = window.setTimeout(() => {
            taskTimer = undefined;
            void queryClient.invalidateQueries({ queryKey: key });
          }, 300);
          continue;
        }
        void queryClient.invalidateQueries({ queryKey: key });
      }
    };

    const connect = () => {
      if (disposed) return;
      const url = apiUrl(
        lastEventId === '' ? '/events' : `/events?lastEventId=${encodeURIComponent(lastEventId)}`,
      );
      source = new EventSource(url, { withCredentials: true });
      source.onopen = () => {
        const reconnected = attempts > 0;
        attempts = 0;
        if (!reconnected) return;
        void queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
        publishMailEvent('stream.reconnected', { lastEventId });
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
      if (taskTimer !== undefined) window.clearTimeout(taskTimer);
      if (source) {
        for (const name of EVENT_NAMES) {
          source.removeEventListener(name, handle as EventListener);
        }
        source.close();
      }
    };
  }, [enabled, queryClient]);
}
