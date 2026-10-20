import { describe, expect, it } from 'vitest';
import type { Task } from './api';
import { buildTaskRing, taskColorToken, taskSegmentGeometry } from './aggregate';

function task(overrides: Partial<Task> & Pick<Task, 'id' | 'type' | 'status'>): Task {
  return {
    done: 0,
    total: 0,
    unit: 'messages',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('task aggregation', () => {
  it('returns an idle model for no tasks', () => {
    const ring = buildTaskRing([]);
    expect(ring.segments).toEqual([]);
    expect(ring.percent).toBe(0);
    expect(ring.activeCount).toBe(0);
    expect(ring.failedCount).toBe(0);
  });

  it('aggregates progress across task types and weights by workload', () => {
    const ring = buildTaskRing([
      task({ id: 'a', type: 'mailbox_sync', status: 'running', done: 40, total: 100 }),
      task({ id: 'b', type: 'body_fetch', status: 'pending', total: 10 }),
      task({ id: 'c', type: 'search_index', status: 'completed', done: 100, total: 100 }),
    ]);
    expect(ring.totalDone).toBe(140);
    expect(ring.totalTotal).toBe(210);
    expect(ring.percent).toBe(67);
    expect(ring.runningCount).toBe(1);
    expect(ring.segments.map((segment) => segment.type)).toEqual([
      'mailbox_sync',
      'body_fetch',
      'search_index',
    ]);
    expect(ring.segments[0].fraction).toBeCloseTo(0.4);
    expect(ring.segments[1].fraction).toBe(0);
    expect(ring.segments[1].pending).toBe(true);
  });

  it('pins failed tasks first and paints them red', () => {
    const ring = buildTaskRing([
      task({ id: 'running', type: 'mailbox_sync', status: 'running', done: 1, total: 10 }),
      task({
        id: 'failed',
        type: 'search_index',
        status: 'failed',
        done: 2,
        total: 5,
        error: 'index offline',
      }),
      task({ id: 'pending', type: 'body_fetch', status: 'pending', total: 5 }),
    ]);
    expect(ring.segments[0].id).toBe('failed');
    expect(ring.segments[0].colorToken).toBe('--task-error');
    expect(ring.segments[0].fraction).toBe(1);
    expect(ring.segments[0].failed).toBe(true);
    expect(ring.failedCount).toBe(1);
    expect(ring.segments.at(-1)?.id).toBe('pending');
  });

  it('maps task types to theme color tokens', () => {
    expect(taskColorToken('initial_sync', false)).toBe('--task-sync');
    expect(taskColorToken('outbox_send', false)).toBe('--task-send');
    expect(taskColorToken('mark_cache', false)).toBe('--task-fetch');
    expect(taskColorToken('search_index', false)).toBe('--task-index');
    expect(taskColorToken('delete_queue', false)).toBe('--task-muted');
    expect(taskColorToken('unknown_type', false)).toBe('--task-muted');
    expect(taskColorToken('initial_sync', true)).toBe('--task-error');
  });

  it('ignores cancelled tasks', () => {
    const ring = buildTaskRing([
      task({ id: 'cancelled', type: 'mailbox_sync', status: 'cancelled', total: 5 }),
    ]);
    expect(ring.segments).toEqual([]);
  });

  it('produces arcs whose lengths fill the ring', () => {
    const ring = buildTaskRing([
      task({ id: 'a', type: 'mailbox_sync', status: 'running', done: 1, total: 2 }),
      task({ id: 'b', type: 'body_fetch', status: 'running', done: 1, total: 3 }),
    ]);
    const circumference = 2 * Math.PI * 16;
    const geometry = taskSegmentGeometry(ring.segments, circumference);
    expect(geometry.reduce((sum, entry) => sum + entry.length, 0)).toBeCloseTo(circumference, 5);
    expect(geometry[0].fillLength).toBeCloseTo(geometry[0].length * 0.5, 5);
    expect(geometry[1].offset).toBeCloseTo(geometry[0].length, 5);
  });
});
