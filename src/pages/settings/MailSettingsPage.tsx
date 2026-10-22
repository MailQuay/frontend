import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { ErrorState, LoadingState } from '@/components/common/States';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import {
  fetchSettings,
  settingsKeys,
  updateSettings,
  type SettingsUpdate,
} from '@/features/settings/api';
import {
  SettingsDivider,
  SettingsRow,
  SettingsSection,
} from '@/features/settings/SettingsSection';

interface MailFormState {
  defaultInitialSyncRange: NonNullable<SettingsUpdate['defaultInitialSyncRange']>;
  defaultDownloadScope: NonNullable<SettingsUpdate['defaultDownloadScope']>;
  preserveMarkedOnAccountDelete: boolean;
  sentSyncMode: NonNullable<SettingsUpdate['sentSyncMode']>;
  draftSyncMode: NonNullable<SettingsUpdate['draftSyncMode']>;
  draftPullIntervalSeconds: number;
  draftPushDelaySeconds: number;
  composeWindowMode: NonNullable<SettingsUpdate['composeWindowMode']>;
  sendRetryLimit: number;
  signaturePosition: NonNullable<SettingsUpdate['signaturePosition']>;
}

const EMPTY: MailFormState = {
  defaultInitialSyncRange: 'all',
  defaultDownloadScope: 'full_no_attachments',
  preserveMarkedOnAccountDelete: true,
  sentSyncMode: 'pull',
  draftSyncMode: 'pull',
  draftPullIntervalSeconds: 60,
  draftPushDelaySeconds: 30,
  composeWindowMode: 'in_app',
  sendRetryLimit: 3,
  signaturePosition: 'above_quote',
};

export function MailSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const message = useErrorMessage();
  const query = useQuery({ queryKey: settingsKeys.detail, queryFn: fetchSettings });
  const [form, setForm] = useState<MailFormState>(EMPTY);

  useEffect(() => {
    if (!query.data) return;
    const settings = query.data;
    setForm({
      defaultInitialSyncRange: settings.defaultInitialSyncRange,
      defaultDownloadScope: settings.defaultDownloadScope,
      preserveMarkedOnAccountDelete: settings.preserveMarkedOnAccountDelete,
      sentSyncMode: settings.sentSyncMode,
      draftSyncMode: settings.draftSyncMode,
      draftPullIntervalSeconds: settings.draftPullIntervalSeconds,
      draftPushDelaySeconds: settings.draftPushDelaySeconds,
      composeWindowMode: settings.composeWindowMode,
      sendRetryLimit: settings.sendRetryLimit,
      signaturePosition: settings.signaturePosition,
    });
  }, [query.data]);

  const update = <K extends keyof MailFormState>(key: K, value: MailFormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const save = useMutation({
    mutationFn: (body: SettingsUpdate) => updateSettings(body),
    onSuccess: (updated) => {
      queryClient.setQueryData(settingsKeys.detail, updated);
      toast(t('settings.mail.saved'));
    },
    onError: (saveError) =>
      toast(t('common.saveFailed'), {
        description: message(saveError),
        variant: 'destructive',
      }),
  });

  const saveListBehavior = useMutation({
    mutationFn: (
      patch: Pick<SettingsUpdate, 'removeReadImmediately' | 'prependNewMessages'>,
    ) => updateSettings(patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(settingsKeys.detail, updated);
    },
    onError: (saveError) =>
      toast(t('common.saveFailed'), {
        description: message(saveError),
        variant: 'destructive',
      }),
  });

  const submit = () => {
    if (form.draftPullIntervalSeconds < 10 || form.draftPullIntervalSeconds > 3600) {
      toast(t('common.saveFailed'), {
        description: `${t('settings.mail.draftPullInterval')}: 10–3600`,
        variant: 'destructive',
      });
      return;
    }
    if (form.draftPushDelaySeconds < 10 || form.draftPushDelaySeconds > 600) {
      toast(t('common.saveFailed'), {
        description: `${t('settings.mail.draftPushDelay')}: 10–600`,
        variant: 'destructive',
      });
      return;
    }
    if (form.sendRetryLimit < 0 || form.sendRetryLimit > 10) {
      toast(t('common.saveFailed'), {
        description: `${t('settings.mail.sendRetryLimit')}: 0–10`,
        variant: 'destructive',
      });
      return;
    }
    save.mutate({
      defaultInitialSyncRange: form.defaultInitialSyncRange,
      defaultDownloadScope: form.defaultDownloadScope,
      preserveMarkedOnAccountDelete: form.preserveMarkedOnAccountDelete,
      sentSyncMode: form.sentSyncMode,
      draftSyncMode: form.draftSyncMode,
      draftPullIntervalSeconds: form.draftPullIntervalSeconds,
      draftPushDelaySeconds: form.draftPushDelaySeconds,
      composeWindowMode: form.composeWindowMode,
      sendRetryLimit: form.sendRetryLimit,
      signaturePosition: form.signaturePosition,
    });
  };

  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <div>
      <SettingsSection
        title={t('settings.mail.syncDefaults')}
        description={t('settings.mail.defaultAccountHint')}
      >
        <SettingsRow
          title={t('settings.mail.syncRange')}
          htmlFor="mail-sync-range"
          control={
            <Select
              value={form.defaultInitialSyncRange}
              onValueChange={(value) =>
                update(
                  'defaultInitialSyncRange',
                  value === '1d' || value === '3d' || value === '1w' || value === '1m' || value === '1y'
                    ? value
                    : 'all',
                )
              }
            >
              <SelectTrigger id="mail-sync-range" className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['all', '1d', '3d', '1w', '1m', '1y'] as const).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`account.syncRanges.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
        <SettingsDivider />
        <SettingsRow
          title={t('settings.mail.downloadScope')}
          htmlFor="mail-download-scope"
          control={
            <Select
              value={form.defaultDownloadScope}
              onValueChange={(value) =>
                update(
                  'defaultDownloadScope',
                  value === 'headers' || value === 'full_with_attachments'
                    ? value
                    : 'full_no_attachments',
                )
              }
            >
              <SelectTrigger id="mail-download-scope" className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['headers', 'full_no_attachments', 'full_with_attachments'] as const).map(
                  (value) => (
                    <SelectItem key={value} value={value}>
                      {t(`account.downloadScopes.${value}`)}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          }
        />
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection title={t('settings.mail.accountDeletion')}>
        <SettingsRow
          title={t('settings.mail.preserveMarked')}
          description={t('settings.mail.preserveMarkedHint')}
          control={
            <Switch
              checked={form.preserveMarkedOnAccountDelete}
              onCheckedChange={(value) => update('preserveMarkedOnAccountDelete', value)}
              aria-label={t('settings.mail.preserveMarked')}
            />
          }
        />
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection title={t('settings.mail.sentDrafts')}>
        <SettingsRow
          title={t('settings.mail.sentSyncMode')}
          htmlFor="mail-sent-sync"
          control={
            <Select
              value={form.sentSyncMode}
              onValueChange={(value) => update('sentSyncMode', value === 'off' ? 'off' : 'pull')}
            >
              <SelectTrigger id="mail-sent-sync" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pull">{t('settings.mail.sentSyncOptions.pull')}</SelectItem>
                <SelectItem value="off">{t('settings.mail.sentSyncOptions.off')}</SelectItem>
              </SelectContent>
            </Select>
          }
        />
        <SettingsDivider />
        <SettingsRow
          title={t('settings.mail.draftSyncMode')}
          htmlFor="mail-draft-sync"
          control={
            <Select
              value={form.draftSyncMode}
              onValueChange={(value) =>
                update(
                  'draftSyncMode',
                  value === 'local' || value === 'mirror' ? value : 'pull',
                )
              }
            >
              <SelectTrigger id="mail-draft-sync" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">{t('settings.mail.draftSyncOptions.local')}</SelectItem>
                <SelectItem value="pull">{t('settings.mail.draftSyncOptions.pull')}</SelectItem>
                <SelectItem value="mirror">{t('settings.mail.draftSyncOptions.mirror')}</SelectItem>
              </SelectContent>
            </Select>
          }
        />
        <SettingsDivider />
        <SettingsRow
          title={t('settings.mail.draftPullInterval')}
          htmlFor="mail-draft-pull"
          control={
            <Input
              id="mail-draft-pull"
              type="number"
              min={10}
              max={3600}
              value={form.draftPullIntervalSeconds}
              onChange={(event) =>
                update('draftPullIntervalSeconds', Number(event.target.value))
              }
              className="w-28"
            />
          }
        />
        <SettingsDivider />
        <SettingsRow
          title={t('settings.mail.draftPushDelay')}
          htmlFor="mail-draft-push"
          control={
            <Input
              id="mail-draft-push"
              type="number"
              min={10}
              max={600}
              value={form.draftPushDelaySeconds}
              onChange={(event) => update('draftPushDelaySeconds', Number(event.target.value))}
              className="w-28"
            />
          }
        />
        <p className="pt-2 text-[11px] text-muted-foreground">{t('settings.mail.localDraftHint')}</p>
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection title={t('settings.mail.sentDrafts')}>
        <SettingsRow
          title={t('settings.mail.composeWindowMode')}
          htmlFor="mail-compose-window"
          control={
            <Select
              value={form.composeWindowMode}
              onValueChange={(value) =>
                update('composeWindowMode', value === 'new_window' ? 'new_window' : 'in_app')
              }
            >
              <SelectTrigger id="mail-compose-window" className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_app">{t('settings.mail.composeOptions.in_app')}</SelectItem>
                <SelectItem value="new_window">
                  {t('settings.mail.composeOptions.new_window')}
                </SelectItem>
              </SelectContent>
            </Select>
          }
        />
        <SettingsDivider />
        <SettingsRow
          title={t('settings.mail.sendRetryLimit')}
          description={t('settings.mail.sendRetryHint')}
          htmlFor="mail-send-retry"
          control={
            <Input
              id="mail-send-retry"
              type="number"
              min={0}
              max={10}
              value={form.sendRetryLimit}
              onChange={(event) => update('sendRetryLimit', Number(event.target.value))}
              className="w-24"
            />
          }
        />
        <SettingsDivider />
        <SettingsRow
          title={t('settings.mail.signaturePosition')}
          htmlFor="mail-signature-position"
          control={
            <Select
              value={form.signaturePosition}
              onValueChange={(value) =>
                update('signaturePosition', value === 'below_quote' ? 'below_quote' : 'above_quote')
              }
            >
              <SelectTrigger id="mail-signature-position" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="above_quote">
                  {t('settings.mail.signatureOptions.above_quote')}
                </SelectItem>
                <SelectItem value="below_quote">
                  {t('settings.mail.signatureOptions.below_quote')}
                </SelectItem>
              </SelectContent>
            </Select>
          }
        />
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection
        title={t('settings.mail.listBehavior')}
        description={t('settings.mail.listBehaviorHint')}
      >
        <SettingsRow
          title={t('settings.mail.removeReadImmediately')}
          description={t('settings.mail.removeReadImmediatelyHint')}
          control={
            <Switch
              checked={query.data.removeReadImmediately}
              onCheckedChange={(value) =>
                saveListBehavior.mutate({ removeReadImmediately: value })
              }
              disabled={saveListBehavior.isPending}
              aria-label={t('settings.mail.removeReadImmediately')}
            />
          }
        />
        <SettingsDivider />
        <SettingsRow
          title={t('settings.mail.prependNewMessages')}
          description={t('settings.mail.prependNewMessagesHint')}
          control={
            <Switch
              checked={query.data.prependNewMessages}
              onCheckedChange={(value) => saveListBehavior.mutate({ prependNewMessages: value })}
              disabled={saveListBehavior.isPending}
              aria-label={t('settings.mail.prependNewMessages')}
            />
          }
        />
      </SettingsSection>

      <SettingsDivider />
      <div className="flex items-center gap-3 pt-4">
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending ? t('common.saving') : t('settings.mail.save')}
        </Button>
      </div>
    </div>
  );
}
