import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  Download,
  Inbox,
  ListChecks,
  Loader2,
  MoreHorizontal,
  Search,
  Send,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ErrorState, LoadingState } from '@/components/common/States';
import { toast } from '@/components/ui/toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { formatDate } from '@/lib/format';
import { fetchMailboxTree } from '@/features/mailboxes/api';
import { fetchOutbox, retryOutbox } from '@/features/compose/outbox-api';
import {
  deleteTask,
  deleteTasksByType,
  dismissTask,
  fetchTasks,
  retryTask,
  taskKeys,
} from './api';
import { buildTaskQueue, type Task, type TaskSegment } from './aggregate';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'active' | 'completed' | 'failed';

const FILTERS: Filter[] = ['all', 'active', 'completed', 'failed'];

const STATUS_TONE: Record<string, string> = {
  running: '--task-fetch',
  pending: '--task-muted',
  failed: '--task-error',
  completed: '--task-sync',
};

const TYPE_ICONS: Record<string, LucideIcon> = {
  initial_sync: Inbox,
  mailbox_sync: Inbox,
  sync: Inbox,
  search_index: Search,
  index: Search,
  body_fetch: Download,
  mark_cache: Download,
  archive_cache: Download,
  fetch: Download,
  outbox_send: Send,
  send: Send,
  account_purge: Trash2,
  cleanup: Trash2,
};

interface QueueRow extends TaskSegment {
  runs?: number;
  ids?: string[];
  sourceTypes?: string[];
}

function typeLabel(t: (key: string, options?: Record<string, unknown>) => string, type: string) {
  return t(`tasks.type.${type}`, { defaultValue: t('tasks.type.unknown') });
}

function statusLabel(t: (key: string) => string, segment: TaskSegment): string {
  if (segment.failed) return t('tasks.stats.failed');
  if (segment.pending) return t('tasks.stats.pending');
  if (segment.completed) return t('tasks.stats.completed');
  return t('tasks.stats.running');
}

function formatDuration(
  t: (key: string, options?: Record<string, unknown>) => string,
  ms: number,
): string {
  const total = Math.max(0, Math.round(ms / 1000));
  if (total < 60) return t('tasks.durationSeconds', { count: total });
  const minutes = Math.floor(total / 60);
  if (minutes < 60) {
    return t('tasks.durationMinutes', { minutes, seconds: total % 60 });
  }
  return t('tasks.durationHours', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}

// Completed work of the same type is folded into one row so a steady stream
// of indexing or sync runs does not flood the task center.
function mergeCompleted(segments: TaskSegment[]): QueueRow[] {
  const groups = new Map<string, QueueRow>();
  for (const segment of segments) {
    const key = `${segment.type}|${segment.accountId ?? ''}`;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { ...segment, runs: 1, ids: [segment.id], sourceTypes: [segment.sourceType] });
      continue;
    }
    group.done += segment.done;
    group.total += segment.total;
    group.runs = (group.runs ?? 1) + 1;
    group.ids = [...(group.ids ?? []), segment.id];
    if (!group.sourceTypes?.includes(segment.sourceType)) {
      group.sourceTypes = [...(group.sourceTypes ?? []), segment.sourceType];
    }
    if (segment.completedAt && (!group.completedAt || segment.completedAt > group.completedAt)) {
      group.completedAt = segment.completedAt;
    }
  }
  return [...groups.values()].sort((left, right) =>
    (right.completedAt ?? '').localeCompare(left.completedAt ?? ''),
  );
}

function TaskMenu({
  task,
  label,
  onDelete,
}: {
  task: Task | undefined;
  label: string;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const message = useErrorMessage();
  const failed = task?.status === 'failed';
  const outbox = useQuery({
    queryKey: ['outbox', 'list'],
    queryFn: fetchOutbox,
    enabled: Boolean(failed && task && (task.type === 'outbox_send' || task.type === 'send')),
  });
  const matchingOutbox = outbox.data?.find(
    (item) =>
      item.status === 'failed' &&
      task &&
      (!task.accountId ||
        item.accountId === task.accountId ||
        item.identityAccountId === task.accountId),
  );

  const retry = useMutation({
    mutationFn: () =>
      task && matchingOutbox ? retryOutbox(matchingOutbox.id) : retryTask(task?.id ?? ''),
    onSuccess: () => {
      toast(t('tasks.retried'));
      void queryClient.invalidateQueries({ queryKey: ['outbox'] });
      void queryClient.invalidateQueries({ queryKey: taskKeys.list });
    },
    onError: (error) =>
      toast(t('common.updateFailed'), { description: message(error), variant: 'destructive' }),
  });

  const dismiss = useMutation({
    mutationFn: () => dismissTask(task?.id ?? ''),
    onSuccess: () => {
      toast(t('tasks.dismissed'));
      void queryClient.invalidateQueries({ queryKey: taskKeys.list });
    },
    onError: (error) =>
      toast(t('tasks.dismissFailed'), { description: message(error), variant: 'destructive' }),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label}>
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {failed ? (
          <>
            <DropdownMenuItem onSelect={() => retry.mutate()} disabled={retry.isPending}>
              {t('tasks.retry')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => dismiss.mutate()} disabled={dismiss.isPending}>
              {t('tasks.dismiss')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem onSelect={onDelete} className="text-destructive">
          {t('tasks.delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TaskRow({
  segment,
  task,
  accountEmail,
  runs,
  now,
  onDelete,
}: {
  segment: TaskSegment;
  task: Task | undefined;
  accountEmail: string | undefined;
  runs?: number;
  now: number;
  onDelete: () => void;
}) {
  const { t, i18n } = useTranslation();
  const Icon = TYPE_ICONS[segment.type] ?? Clock3;
  const tone = STATUS_TONE[segment.status] ?? '--task-muted';
  const meta = [accountEmail ?? t('tasks.globalTask'), runs && runs > 1 ? t('tasks.mergedRuns', { count: runs }) : null]
    .filter(Boolean)
    .join(' · ');
  const showBar = segment.status !== 'completed' && segment.total > 0;
  const started = task?.startedAt ? new Date(task.startedAt).getTime() : null;
  const finishedAt = segment.completedAt ?? task?.completedAt ?? task?.updatedAt;
  const end = segment.completed ? new Date(finishedAt ?? '').getTime() : now;
  const elapsed = started && !Number.isNaN(end) ? formatDuration(t, end - started) : '';
  const durationLabel = segment.pending
    ? t('tasks.queuedFor', { duration: elapsed })
    : segment.completed || segment.failed
      ? t('tasks.took', { duration: elapsed })
      : t('tasks.runningFor', { duration: elapsed });
  const completedAt = segment.completed
    ? t('tasks.completedAt', {
        time: formatDate(segment.completedAt ?? finishedAt, i18n.language, undefined, {
          timeStyle: 'short',
        }),
      })
    : '';

  return (
    <li className="px-4 py-4 md:px-5">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-2">
            <p className="truncate text-sm font-medium leading-[18px]">{typeLabel(t, segment.type)}</p>
            {completedAt ? (
              <span className="shrink-0 text-xs text-muted-foreground">{completedAt}</span>
            ) : null}
          </div>
          <p className="truncate text-xs leading-[18px] text-muted-foreground">{meta}</p>
        </div>
        <Badge
          variant="outline"
          className="shrink-0 border-transparent"
          style={{
            color: `var(${tone})`,
            backgroundColor: `color-mix(in oklab, var(${tone}) 14%, transparent)`,
          }}
        >
          {statusLabel(t, segment)}
        </Badge>
        <TaskMenu task={task} label={t('tasks.actions')} onDelete={onDelete} />
      </div>
      <div className="pl-12">
        {showBar ? (
          <>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="truncate tabular-nums">
                {segment.total > 0
                  ? t('tasks.counts', { done: segment.done, total: segment.total, unit: segment.unit })
                  : t('tasks.countsUnknown', { done: segment.done })}
              </span>
              <span className="shrink-0 tabular-nums">{t('tasks.percent', { percent: segment.percent })}</span>
            </div>
            <div
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={segment.percent}
              aria-label={typeLabel(t, segment.type)}
            >
              <div
                className="h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
                style={{ width: `${segment.percent}%`, backgroundColor: `var(${tone})` }}
              />
            </div>
          </>
        ) : null}
        {segment.error ? (
          <p className="mt-2 line-clamp-2 text-xs text-destructive" title={segment.error}>
            {segment.error}
          </p>
        ) : null}
        {!segment.completed && elapsed ? (
          <p className="mt-2 text-xs text-muted-foreground">{durationLabel}</p>
        ) : null}
      </div>
    </li>
  );
}

function TaskCenterEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl border bg-background">
        <ListChecks className="size-5 text-muted-foreground" aria-hidden="true" />
      </span>
      <p className="mt-1 text-sm font-medium">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export function TaskCenterPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const message = useErrorMessage();
  useDocumentTitle(t('tasks.centerTitle'));

  const [filter, setFilter] = useState<Filter>('all');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const query = useQuery({ queryKey: taskKeys.list, queryFn: fetchTasks });
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
  const completed = useMemo(
    () => mergeCompleted(queue.segments.filter((segment) => segment.completed)),
    [queue.segments],
  );
  const runningCount = queue.segments.filter((segment) => segment.status === 'running').length;
  const pendingCount = queue.segments.filter((segment) => segment.pending).length;
  const completedCount = queue.segments.filter((segment) => segment.completed).length;

  const removeTask = useMutation({
    mutationFn: async (row: QueueRow) => {
      if (row.runs && row.runs > 1) {
        await deleteTasksByType(row.sourceTypes ?? [row.sourceType], row.accountId);
        return;
      }
      await Promise.all((row.ids ?? [row.id]).map((id) => deleteTask(id)));
    },
    onSuccess: () => {
      toast(t('tasks.deleted'));
      void queryClient.invalidateQueries({ queryKey: taskKeys.list });
    },
    onError: (error) =>
      toast(t('common.deleteFailed'), { description: message(error), variant: 'destructive' }),
  });

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const rows: QueueRow[] =
    filter === 'active'
      ? active
      : filter === 'failed'
        ? failed
        : filter === 'completed'
          ? completed
          : [...active, ...failed, ...completed];

  const emptyCopy =
    filter === 'active'
      ? { title: t('tasks.emptyActiveTitle'), description: t('tasks.emptyActiveBody') }
      : filter === 'completed'
        ? { title: t('tasks.emptyCompletedTitle'), description: t('tasks.emptyCompletedBody') }
        : filter === 'failed'
          ? { title: t('tasks.emptyFailedTitle'), description: t('tasks.emptyFailedBody') }
          : { title: t('tasks.emptyTitle'), description: t('tasks.emptyBody') };

  const stats = [
    { key: 'running', label: t('tasks.stats.running'), count: runningCount, icon: Loader2, spin: true },
    { key: 'pending', label: t('tasks.stats.pending'), count: pendingCount, icon: Clock3, spin: false },
    { key: 'failed', label: t('tasks.stats.failed'), count: failed.length, icon: CircleAlert, spin: false },
    {
      key: 'completed',
      label: t('tasks.stats.completed'),
      count: completedCount,
      icon: CheckCircle2,
      spin: false,
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1050px] px-4 pb-10 pt-8 md:px-6">
          <header className="min-w-0">
            <h1 className="text-xl font-semibold">{t('tasks.centerTitle')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('tasks.centerSubtitle')}</p>
          </header>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.key}
                  className="flex h-[96px] flex-col justify-between rounded-xl border bg-card p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{stat.label}</span>
                    <Icon
                      className={cn('size-4 text-muted-foreground', stat.spin && 'animate-spin')}
                      aria-hidden="true"
                    />
                  </div>
                  <span className="text-2xl font-semibold tabular-nums">{stat.count}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <div role="tablist" aria-label={t('tasks.filters.label')} className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
              {FILTERS.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={filter === key}
                  onClick={() => setFilter(key)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    filter === key
                      ? 'bg-background font-medium text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t(`tasks.filters.${key}`)}
                </button>
              ))}
            </div>
          </div>

          <section className="mt-4 rounded-xl border bg-card/40">
            <div className="flex items-start justify-between gap-4 border-b px-4 py-3 md:px-5">
              <div className="min-w-0">
                <p className="text-sm font-medium">{t('tasks.recentTitle')}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t('tasks.recentSubtitle')}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{t('tasks.recentWindow')}</span>
            </div>
            {query.isPending ? (
              <LoadingState label={t('app.loading')} />
            ) : query.isError ? (
              <ErrorState error={query.error} onRetry={() => void query.refetch()} />
            ) : rows.length === 0 ? (
              <TaskCenterEmpty title={emptyCopy.title} description={emptyCopy.description} />
            ) : (
              <ul aria-live="polite">
                {rows.map((segment) => {
                  const task = taskById.get(segment.id);
                  return (
                    <TaskRow
                      key={segment.id}
                      segment={segment}
                      task={task}
                      accountEmail={emailByAccount[segment.accountId ?? '']}
                      runs={segment.runs}
                      now={now}
                      onDelete={() => removeTask.mutate(segment)}
                    />
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
