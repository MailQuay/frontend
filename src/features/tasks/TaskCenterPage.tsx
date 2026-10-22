import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { toast } from '@/components/ui/toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { fetchMailboxTree } from '@/features/mailboxes/api';
import { fetchOutbox, retryOutbox } from '@/features/compose/outbox-api';
import { dismissTask, fetchTasks, retryTask, taskKeys } from './api';
import { buildTaskQueue, type Task, type TaskSegment } from './aggregate';

function typeLabel(t: (key: string, options?: Record<string, unknown>) => string, type: string) {
  return t(`tasks.type.${type}`, { defaultValue: t('tasks.type.unknown') });
}

function statusLabel(
  t: (key: string) => string,
  segment: TaskSegment,
): { label: string; variant: 'secondary' | 'muted' | 'destructive' } {
  if (segment.failed) return { label: t('tasks.failedLabel'), variant: 'destructive' };
  if (segment.pending) return { label: t('tasks.pending'), variant: 'muted' };
  if (segment.completed) return { label: t('tasks.completed'), variant: 'muted' };
  return { label: t('tasks.runningLabel'), variant: 'secondary' };
}

function TaskRow({
  segment,
  accountEmail,
  actions,
}: {
  segment: TaskSegment;
  accountEmail: string | undefined;
  actions?: ReactNode;
}) {
  const { t } = useTranslation();
  const status = statusLabel(t, segment);
  return (
    <li className="border-b px-4 py-3 last:border-b-0 md:px-6">
      <div className="flex items-center gap-2">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: `var(${segment.colorToken})` }}
          aria-hidden="true"
        />
        <p className="min-w-0 flex-1 truncate text-sm">{typeLabel(t, segment.type)}</p>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>
      <div className="mt-2 flex items-center gap-3 pl-4">
        <div
          className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={segment.percent}
          aria-label={typeLabel(t, segment.type)}
        >
          <div
            className="h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${segment.percent}%`, backgroundColor: `var(${segment.colorToken})` }}
          />
        </div>
        <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
          {t('tasks.percent', { percent: segment.percent })}
        </span>
      </div>
      <p className="mt-1 pl-4 text-[11px] text-muted-foreground">
        {accountEmail ?? t('tasks.account')} ·{' '}
        {segment.total > 0
          ? t('tasks.counts', { done: segment.done, total: segment.total, unit: segment.unit })
          : t('tasks.countsUnknown', { done: segment.done })}
      </p>
      {segment.error ? (
        <p className="mt-1 line-clamp-2 pl-4 text-[11px] text-destructive" title={segment.error}>
          {segment.error}
        </p>
      ) : null}
      {actions ? <div className="mt-2">{actions}</div> : null}
    </li>
  );
}

function FailedTaskActions({ task }: { task: Task }) {
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
    mutationFn: () => (matchingOutbox ? retryOutbox(matchingOutbox.id) : retryTask(task.id)),
    onSuccess: () => {
      toast(t('tasks.retried'));
      void queryClient.invalidateQueries({ queryKey: ['outbox'] });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) =>
      toast(t('common.updateFailed'), { description: message(error), variant: 'destructive' }),
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
    <div className="flex flex-wrap gap-1.5 pl-4">
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs"
        onClick={() => retry.mutate()}
        disabled={retry.isPending}
      >
        {t('tasks.retry')}
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

export function TaskCenterPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('tasks.centerTitle'));

  const query = useQuery({
    queryKey: taskKeys.list,
    queryFn: fetchTasks,
    refetchInterval: 10_000,
  });
  const tasks = useMemo(() => query.data ?? [], [query.data]);
  const queue = useMemo(() => buildTaskQueue(tasks), [tasks]);
  const tree = useQuery({
    queryKey: ['mailboxes', 'tree'],
    queryFn: fetchMailboxTree,
    enabled: tasks.some((task) => Boolean(task.accountId)),
  });

  const emailByAccount: Record<string, string> = {};
  for (const entry of tree.data?.accounts ?? []) {
    emailByAccount[entry.account.id] = entry.account.email;
  }

  const active = queue.segments.filter((segment) => !segment.completed && !segment.failed);
  const failed = queue.segments.filter((segment) => segment.failed);
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  const section = (title: string, segments: TaskSegment[], heading?: ReactNode) =>
    segments.length === 0 ? null : (
      <section className="border-b last:border-b-0">
        <h2 className="flex items-center gap-1.5 px-4 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:px-6">
          {heading}
          {title}
        </h2>
        <ul>
          {segments.map((segment) => {
            const task = taskById.get(segment.id);
            return (
              <TaskRow
                key={segment.id}
                segment={segment}
                accountEmail={emailByAccount[segment.accountId ?? '']}
                actions={task && segment.failed ? <FailedTaskActions task={task} /> : null}
              />
            );
          })}
        </ul>
      </section>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex min-h-14 shrink-0 items-center border-b px-4 py-2 md:px-6">
        <div className="mx-auto flex w-full max-w-3xl min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold">{t('tasks.centerTitle')}</h1>
            <p className="text-xs text-muted-foreground">
              {t('tasks.centerDescription', { count: queue.activeCount })}
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('topbar.refresh')}
                onClick={() => void query.refetch()}
                disabled={query.isFetching}
              >
                <RefreshCw
                  className={query.isFetching ? 'size-4 animate-spin' : 'size-4'}
                  aria-hidden="true"
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('topbar.refresh')}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
          {query.isPending ? (
            <LoadingState label={t('app.loading')} />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : queue.segments.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle className="size-5" aria-hidden="true" />}
              title={t('tasks.emptyTitle')}
              description={t('tasks.emptyBody')}
            />
          ) : (
            <div aria-live="polite">
              {section(t('tasks.activeTitle'), active)}
              {section(
                t('tasks.failedTitle'),
                failed,
                <AlertTriangle className="size-3 text-destructive" aria-hidden="true" />,
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
