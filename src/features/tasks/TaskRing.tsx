import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { fetchTasks, taskKeys } from './api';
import { buildTaskRing, taskSegmentGeometry, type Task } from './aggregate';
import { TaskPanelBody } from './TaskPanel';

const RADIUS = 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function TaskRing({ tasks: providedTasks }: { tasks?: Task[] } = {}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());
  const closeTimerRef = useRef<number | undefined>(undefined);
  const suppressFocusRef = useRef(false);
  const suppressTimerRef = useRef<number | undefined>(undefined);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const tasksQuery = useQuery({
    queryKey: taskKeys.list,
    queryFn: fetchTasks,
    refetchInterval: providedTasks ? false : 30_000,
    refetchOnWindowFocus: false,
    staleTime: 5_000,
    enabled: providedTasks === undefined,
  });
  const tasks: Task[] = useMemo(
    () => providedTasks ?? tasksQuery.data ?? [],
    [providedTasks, tasksQuery.data],
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      suppressFocusRef.current = true;
      setOpen(false);
      if (suppressTimerRef.current !== undefined) window.clearTimeout(suppressTimerRef.current);
      suppressTimerRef.current = window.setTimeout(() => {
        suppressFocusRef.current = false;
      }, 250);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    for (const task of tasks) {
      if (task.status !== 'completed') continue;
      if (timersRef.current.has(task.id)) continue;
      const timer = window.setTimeout(() => {
        setHiddenIds((previous) => (previous.includes(task.id) ? previous : [...previous, task.id]));
        timersRef.current.delete(task.id);
      }, 2000);
      timersRef.current.set(task.id, timer);
    }
  }, [tasks]);

  useEffect(
    () => () => {
      for (const timer of timersRef.current.values()) window.clearTimeout(timer);
      if (closeTimerRef.current !== undefined) window.clearTimeout(closeTimerRef.current);
      if (suppressTimerRef.current !== undefined) window.clearTimeout(suppressTimerRef.current);
    },
    [],
  );

  const visible = useMemo(
    () => tasks.filter((task) => task.status !== 'cancelled' && !hiddenIds.includes(task.id)),
    [tasks, hiddenIds],
  );
  const ring = useMemo(() => buildTaskRing(visible), [visible]);
  const geometry = useMemo(() => taskSegmentGeometry(ring.segments, CIRCUMFERENCE), [ring]);

  const cancelClose = () => {
    if (closeTimerRef.current !== undefined) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = undefined;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => {
      suppressFocusRef.current = true;
      setOpen(false);
      if (suppressTimerRef.current !== undefined) window.clearTimeout(suppressTimerRef.current);
      suppressTimerRef.current = window.setTimeout(() => {
        suppressFocusRef.current = false;
      }, 250);
    }, 120);
  };

  const label =
    ring.activeCount === 0
      ? t('tasks.idleLabel')
      : t('tasks.progressLabel', { percent: ring.percent });

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          cancelClose();
          setOpen(true);
          return;
        }
        scheduleClose();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          onMouseEnter={() => {
            cancelClose();
            setOpen(true);
          }}
          onMouseLeave={scheduleClose}
          onFocus={() => {
            if (suppressFocusRef.current) return;
            cancelClose();
            setOpen(true);
          }}
          onBlur={(event) => {
            const next = event.relatedTarget;
            if (!(next instanceof Node) || !panelRef.current?.contains(next)) scheduleClose();
          }}
          className={cn(
            'relative flex size-10 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            ring.activeCount === 0 && 'ring-1 ring-border/70',
          )}
        >
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={ring.percent}
            aria-label={label}
            className="pointer-events-none"
          >
            <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
              <circle
                cx="18"
                cy="18"
                r={RADIUS}
                fill="none"
                strokeWidth="3"
                style={{ stroke: 'var(--task-ring-idle)' }}
              />
              {ring.activeCount === 0 ? null : (
                <g transform="rotate(-90 18 18)">
                  {geometry.map(({ segment, offset, length, fillLength }) => (
                    <g key={segment.id}>
                      <circle
                        cx="18"
                        cy="18"
                        r={RADIUS}
                        fill="none"
                        strokeWidth="3"
                        strokeLinecap="butt"
                        style={{
                          stroke: `var(${segment.colorToken})`,
                          opacity: segment.pending ? 0.3 : 0.18,
                        }}
                        strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                        strokeDashoffset={-offset}
                      />
                      {fillLength > 0 ? (
                        <circle
                          className="task-segment-fill"
                          cx="18"
                          cy="18"
                          r={RADIUS}
                          fill="none"
                          strokeWidth="3"
                          strokeLinecap="butt"
                          style={{ stroke: `var(${segment.colorToken})` }}
                          strokeDasharray={`${fillLength} ${CIRCUMFERENCE - fillLength}`}
                          strokeDashoffset={-offset}
                        />
                      ) : null}
                    </g>
                  ))}
                </g>
              )}
            </svg>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="task-panel-enter w-72 max-w-80 overflow-hidden p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={() => setOpen(false)}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
      >
        <div
          ref={panelRef}
          onBlur={(event) => {
            const next = event.relatedTarget;
            if (!(next instanceof Node) || !event.currentTarget.contains(next)) scheduleClose();
          }}
        >
          <TaskPanelBody tasks={visible} ring={ring} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
