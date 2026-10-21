import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toast';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { fetchMailboxTree } from '@/features/mailboxes/api';
import { fetchOutbox, retryOutbox } from '@/features/compose/outbox-api';
import { dismissTask, retryTask } from '@/features/tasks/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import type { Task, TaskRingModel, TaskSegment } from './aggregate';

function typeLabel(t: (key: string, options?: Record<string, unknown>) => string, type: string): string {
  return t(`tasks.type.${type}`, { defaultValue: t('tasks.type.unknown') });
}

function segmentStatusLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  segment: TaskSegment,
): string {
  if (segment.failed) return t('tasks.failedTitle');
  if (segment.pending) return t('tasks.pending');
  if (segment.completed) return t('tasks.completed');
  return t('tasks.activeTitle');
}

function SegmentRow({
  segment,
  accountEmail,
}: {
  segment: TaskSegment;
  accountEmail: string | undefined;
}) {
  const { t } = useTranslation();
  const percent =
    segment.total > 0 ? Math.round((segment.done / segment.total) * 100) : segment.completed ? 100 : 0;
  return (
    <div className="flex items-start gap-2 px-3 py-2">
      <span
        className="mt-1 size-2 shrink-0 rounded-full"
        style={{ backgroundColor: `var(${segment.colorToken})` }}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn('truncate text-sm', segment.pending && 'text-muted-foreground')}>
            {typeLabel(t, segment.type)}
          </p>
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {t('tasks.percent', { percent })}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {accountEmail ?? t('tasks.account')} · {segmentStatusLabel(t, segment)}
        </p>
        <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
          {segment.total > 0
            ? t('tasks.counts', { done: segment.done, total: segment.total, unit: segment.unit })
            : t('tasks.countsUnknown', { done: segment.done })}
        </p>
        {segment.error ? (
          <p className="mt-1 line-clamp-2 text-[11px] text-destructive" title={segment.error}>
            {segment.error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function FailedActions({ task }: { task: Task }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const message = useErrorMessage();
  const outbox = useQuery({
    queryKey: ['outbox', 'list'],
    queryFn: fetchOutbox,
    enabled: task.type === 'outbox_send' || task.type === 'send',
  });
  const matchingOutbox = outbox.data?.find(
    (item) =>
      item.status === 'failed' &&
      (!task.accountId || item.accountId === task.accountId || item.identityAccountId === task.accountId),
  );

  const retry = useMutation({
    mutationFn: (id: string) => (matchingOutbox && id === matchingOutbox.id ? retryOutbox(id) : retryTask(task.id)),
    onSuccess: () => {
      toast(t('outbox.retried'));
      void queryClient.invalidateQueries({ queryKey: ['outbox'] });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => toast(t('common.updateFailed'), { description: message(error), variant: 'destructive' }),
  });

  const dismiss = useMutation({
    mutationFn: () => dismissTask(task.id),
    onSuccess: () => {
      toast(t('tasks.dismissed'));
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) =>
      toast(t('tasks.dismissFailed'), { description: message(error), variant: 'destructive' }),
  });

  return (
    <div className="flex flex-wrap gap-1.5 px-3 pb-2 pl-7">
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs"
        onClick={() => retry.mutate(matchingOutbox?.id ?? task.id)}
        disabled={retry.isPending}
      >
        {t('tasks.retry')}
      </Button>
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" asChild>
        <Link to="/drafts">{t('tasks.openDraft')}</Link>
      </Button>
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" asChild>
        <Link to="/sending">{t('tasks.openSending')}</Link>
      </Button>
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" asChild>
        <Link to="/settings/accounts">{t('tasks.openAccount')}</Link>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs"
        onClick={() => dismiss.mutate()}
        disabled={dismiss.isPending}
      >
        <X aria-hidden="true" />
        {t('tasks.dismiss')}
      </Button>
    </div>
  );
}

export function TaskPanelBody({ tasks, ring }: { tasks: Task[]; ring: TaskRingModel }) {
  const { t } = useTranslation();
  const tree = useQuery({
    queryKey: ['mailboxes', 'tree'],
    queryFn: fetchMailboxTree,
    enabled: tasks.some((task) => Boolean(task.accountId)),
  });
  const emailByAccount: Record<string, string> = {};
  for (const entry of tree.data?.accounts ?? []) {
    emailByAccount[entry.account.id] = entry.account.email;
  }
  const failed = tasks.filter((task) => task.status === 'failed');
  const active = tasks.filter((task) => task.status !== 'failed');
  const failedSegments = ring.segments.filter((segment) => segment.failed);
  const activeSegments = ring.segments.filter((segment) => !segment.failed);

  return (
    <div aria-live="polite" className="w-72 max-w-80">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <p className="text-sm font-semibold">{t('tasks.title')}</p>
        <Badge variant="muted">{t('tasks.running', { count: ring.runningCount })}</Badge>
      </div>
      <div className="scrollbar-none max-h-[17.5rem] overflow-y-auto">
        {tasks.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('tasks.empty')}</p>
        ) : null}
        {failedSegments.length > 0 ? (
          <div className="border-b">
            <p className="flex items-center gap-1.5 px-3 pt-2 text-[11px] font-medium uppercase tracking-wide text-destructive">
              <AlertTriangle className="size-3" aria-hidden="true" />
              {t('tasks.failedTitle')}
            </p>
            {failedSegments.map((segment) => {
              const task = failed.find((entry) => entry.id === segment.id);
              return (
                <div key={segment.id}>
                  <SegmentRow segment={segment} accountEmail={emailByAccount[segment.accountId ?? '']} />
                  {task ? <FailedActions task={task} /> : null}
                </div>
              );
            })}
          </div>
        ) : null}
        {activeSegments.map((segment) => {
          const task = active.find((entry) => entry.id === segment.id);
          if (!task) return null;
          return (
            <SegmentRow
              key={segment.id}
              segment={segment}
              accountEmail={emailByAccount[segment.accountId ?? '']}
            />
          );
        })}
      </div>
    </div>
  );
}
