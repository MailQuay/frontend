import type { Schemas } from '@/lib/api/client';

export type Task = Schemas['Task'];
export type TaskStatus = Task['status'];

export type TaskColorToken =
  | '--task-sync'
  | '--task-send'
  | '--task-fetch'
  | '--task-index'
  | '--task-muted'
  | '--task-error';

export interface TaskSegment {
  id: string;
  type: string;
  status: TaskStatus;
  colorToken: TaskColorToken;
  weight: number;
  fraction: number;
  done: number;
  total: number;
  unit: string;
  accountId?: string;
  error?: string;
  pending: boolean;
  failed: boolean;
  completed: boolean;
}

export interface TaskRingModel {
  segments: TaskSegment[];
  totalDone: number;
  totalTotal: number;
  runningCount: number;
  activeCount: number;
  failedCount: number;
  percent: number;
}

const TASK_TOKEN_BY_TYPE: Record<string, TaskColorToken> = {
  initial_sync: '--task-sync',
  mailbox_sync: '--task-sync',
  scope_reconcile: '--task-sync',
  sync: '--task-sync',
  outbox_send: '--task-send',
  send: '--task-send',
  body_fetch: '--task-fetch',
  mark_cache: '--task-fetch',
  archive_cache: '--task-fetch',
  fetch: '--task-fetch',
  search_index: '--task-index',
  index: '--task-index',
  account_purge: '--task-muted',
  cleanup: '--task-muted',
};

export function taskColorToken(type: string, failed: boolean): TaskColorToken {
  if (failed) return '--task-error';
  return TASK_TOKEN_BY_TYPE[type] ?? '--task-muted';
}

export function buildTaskRing(tasks: Task[]): TaskRingModel {
  const segments: TaskSegment[] = [];
  let totalDone = 0;
  let totalTotal = 0;
  let runningCount = 0;
  let failedCount = 0;

  for (const task of tasks) {
    if (task.status === 'cancelled') continue;
    const failed = task.status === 'failed';
    const pending = task.status === 'pending';
    const completed = task.status === 'completed';
    const total = Math.max(0, task.total ?? 0);
    const done = Math.max(0, Math.min(task.done ?? 0, total || Number.MAX_SAFE_INTEGER));
    const weight = total > 0 ? total : 1;
    totalDone += done;
    totalTotal += total;
    if (task.status === 'running') runningCount += 1;
    if (failed) failedCount += 1;
    segments.push({
      id: task.id,
      type: task.type,
      status: task.status,
      colorToken: taskColorToken(task.type, failed),
      weight,
      fraction: failed ? 1 : total > 0 ? done / total : completed ? 1 : 0,
      done,
      total,
      unit: task.unit,
      accountId: task.accountId,
      error: task.error,
      pending,
      failed,
      completed,
    });
  }

  segments.sort((left, right) => {
    if (left.failed !== right.failed) return left.failed ? -1 : 1;
    return 0;
  });

  return {
    segments,
    totalDone,
    totalTotal,
    runningCount,
    activeCount: segments.length,
    failedCount,
    percent:
      totalTotal > 0
        ? Math.max(0, Math.min(100, Math.round((totalDone / totalTotal) * 100)))
        : failedCount > 0
          ? 100
          : segments.length > 0
            ? Math.round(
                (segments.reduce((sum, segment) => sum + segment.fraction * segment.weight, 0) /
                  segments.reduce((sum, segment) => sum + segment.weight, 0)) *
                  100,
              )
            : 0,
  };
}

/**
 * Geometry for the 36px ring: each task owns an arc proportional to its workload.
 * A failed task always receives a full red arc, is sorted first, and is pinned to the top.
 */
export function taskSegmentGeometry(
  segments: TaskSegment[],
  circumference: number,
): Array<{ segment: TaskSegment; offset: number; length: number; fillLength: number }> {
  const totalWeight = segments.reduce((sum, segment) => sum + segment.weight, 0) || 1;
  let cursor = 0;
  return segments.map((segment) => {
    const length = Math.max(1.5, (segment.weight / totalWeight) * circumference);
    const geometry = {
      segment,
      offset: cursor,
      length,
      fillLength: length * segment.fraction,
    };
    cursor += length;
    return geometry;
  });
}
