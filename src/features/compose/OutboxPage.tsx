import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, Clock3, RefreshCw, RotateCcw, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { toast } from '@/components/ui/toast';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatDate, utcToZonedInput, zonedDateTimeToUtc } from '@/lib/format';
import {
  cancelOutbox,
  fetchOutbox,
  outboxKeys,
  rescheduleOutbox,
  retryOutbox,
  type OutboxItem,
} from './outbox-api';
import { fetchSettings, settingsKeys } from '@/features/settings/api';
import { useComposeLauncher } from './useComposeLauncher';

export function OutboxPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const message = useErrorMessage();
  const { launch } = useComposeLauncher();
  const [rescheduleItem, setRescheduleItem] = useState<OutboxItem | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState('');
  const [cancelItem, setCancelItem] = useState<OutboxItem | null>(null);
  useDocumentTitle(t('outbox.title'));

  const query = useQuery({ queryKey: outboxKeys.list, queryFn: fetchOutbox });
  const settings = useQuery({ queryKey: settingsKeys.detail, queryFn: fetchSettings });
  const timezone = settings.data?.timezone;

  const retry = useMutation({
    mutationFn: (id: string) => retryOutbox(id),
    onSuccess: () => {
      toast(t('outbox.retried'));
      void queryClient.invalidateQueries({ queryKey: ['outbox'] });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) =>
      toast(t('common.updateFailed'), { description: message(error), variant: 'destructive' }),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelOutbox(id),
    onSuccess: () => {
      toast(t('outbox.cancelled'));
      setCancelItem(null);
      void queryClient.invalidateQueries({ queryKey: ['outbox'] });
      void queryClient.invalidateQueries({ queryKey: ['drafts'] });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) =>
      toast(t('common.updateFailed'), { description: message(error), variant: 'destructive' }),
  });

  const reschedule = useMutation({
    mutationFn: ({ item, value }: { item: OutboxItem; value: string }) => {
      const utc = zonedDateTimeToUtc(value, timezone);
      if (!utc) throw new Error(t('compose.scheduleInvalid'));
      return rescheduleOutbox(item.id, utc.toISOString());
    },
    onSuccess: () => {
      toast(t('outbox.rescheduled'));
      setRescheduleItem(null);
      void queryClient.invalidateQueries({ queryKey: ['outbox'] });
    },
    onError: (error) =>
      toast(t('outbox.reschedule'), { description: message(error), variant: 'destructive' }),
  });

  const items = query.data ?? [];
  const pendingCancel = cancelItem !== null;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex min-h-14 shrink-0 items-center gap-2 border-b px-4 py-2 md:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold">{t('outbox.title')}</h1>
          <p className="text-xs text-muted-foreground">
            {t('mail.messageCount', { count: items.length })}
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('topbar.refresh')}
              onClick={() => void query.refetch()}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('topbar.refresh')}</TooltipContent>
        </Tooltip>
      </div>

      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Clock3 className="size-5" aria-hidden="true" />}
          title={t('outbox.emptyTitle')}
          description={t('outbox.emptyBody')}
        />
      ) : (
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id} className="px-4 py-3 md:px-6">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Clock3 className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{item.identityEmail}</span>
                      <Badge
                        variant={
                          item.status === 'failed' || item.status === 'copy_failed'
                            ? 'destructive'
                            : item.status === 'sent'
                              ? 'secondary'
                              : 'muted'
                        }
                      >
                        {t(`outbox.statuses.${item.status}`)}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {t('outbox.attempts', { count: item.attempts })}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.scheduledAt
                        ? `${t('outbox.scheduledAt')}: ${formatDate(item.scheduledAt, i18n.language, timezone)}`
                        : t(`outbox.statuses.${item.status}`)}
                    </p>
                    {item.sentAt ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t('outbox.sentAt')}: {formatDate(item.sentAt, i18n.language, timezone)}
                      </p>
                    ) : null}
                    {item.lastError ? (
                      <p className="mt-1 text-xs text-destructive">{item.lastError}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.draftId ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void launch({ draftId: item.draftId, mode: 'new' })}
                      >
                        {t('outbox.openDraft')}
                      </Button>
                    ) : null}
                    {item.status === 'failed' || item.status === 'copy_failed' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => retry.mutate(item.id)}
                        disabled={retry.isPending}
                      >
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                        {t('outbox.retry')}
                      </Button>
                    ) : null}
                    {item.status === 'scheduled' || item.status === 'failed' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => {
                          setRescheduleItem(item);
                          setRescheduleValue(utcToZonedInput(item.scheduledAt, timezone));
                        }}
                      >
                        <CalendarClock className="size-3.5" aria-hidden="true" />
                        {t('outbox.reschedule')}
                      </Button>
                    ) : null}
                    {item.status !== 'sent' && item.status !== 'cancelled' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-destructive hover:text-destructive"
                        onClick={() => setCancelItem(item)}
                      >
                        <XCircle className="size-3.5" aria-hidden="true" />
                        {t('outbox.cancel')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog
        open={rescheduleItem !== null}
        onOpenChange={(open) => {
          if (!open) setRescheduleItem(null);
        }}
      >
        <DialogContent closeLabel={t('common.close')}>
          <DialogHeader>
            <DialogTitle>{t('outbox.reschedule')}</DialogTitle>
            <DialogDescription>
              {t('compose.scheduleHint', { timezone: timezone ?? 'UTC' })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reschedule-at">{t('compose.scheduleLabel')}</Label>
            <Input
              id="reschedule-at"
              type="datetime-local"
              value={rescheduleValue}
              onChange={(event) => setRescheduleValue(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRescheduleItem(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (rescheduleItem) {
                  reschedule.mutate({ item: rescheduleItem, value: rescheduleValue });
                }
              }}
              disabled={reschedule.isPending || rescheduleValue === ''}
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingCancel}
        onOpenChange={(open) => {
          if (!open) setCancelItem(null);
        }}
        title={t('outbox.cancel')}
        description={t('outbox.cancelConfirm')}
        confirmLabel={t('outbox.cancel')}
        pending={cancel.isPending}
        onConfirm={() => {
          if (cancelItem) cancel.mutate(cancelItem.id);
        }}
      />
    </div>
  );
}
