import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { ErrorState, LoadingState } from '@/components/common/States';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { formatBytes } from '@/lib/format';
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

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

type LogLevel = NonNullable<SettingsUpdate['logLevel']>;

interface ServerFormState {
  sessionTtlHours: number;
  syncIntervalSeconds: number;
  pop3IntervalSeconds: number;
  bodyPrefetchMaxBytes: number;
  maxAttachmentBytes: number;
  googleClientId: string;
  microsoftClientId: string;
  googleClientSecret: string;
  microsoftClientSecret: string;
  logLevel: LogLevel;
}

export function ServerSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const message = useErrorMessage();
  const query = useQuery({ queryKey: settingsKeys.detail, queryFn: fetchSettings });
  const [form, setForm] = useState<ServerFormState>({
    sessionTtlHours: 168,
    syncIntervalSeconds: 60,
    pop3IntervalSeconds: 300,
    bodyPrefetchMaxBytes: 2 * MIB,
    maxAttachmentBytes: 25 * MIB,
    googleClientId: '',
    microsoftClientId: '',
    googleClientSecret: '',
    microsoftClientSecret: '',
    logLevel: 'info',
  });

  useEffect(() => {
    if (!query.data) return;
    const settings = query.data;
    setForm({
      sessionTtlHours: settings.sessionTtlHours,
      syncIntervalSeconds: settings.syncIntervalSeconds,
      pop3IntervalSeconds: settings.pop3IntervalSeconds,
      bodyPrefetchMaxBytes: settings.bodyPrefetchMaxBytes,
      maxAttachmentBytes: settings.maxAttachmentBytes,
      googleClientId: settings.googleClientId,
      microsoftClientId: settings.microsoftClientId,
      googleClientSecret: '',
      microsoftClientSecret: '',
      logLevel: settings.logLevel ?? 'info',
    });
  }, [query.data]);

  const save = useMutation({
    mutationFn: (body: SettingsUpdate) => updateSettings(body),
    onSuccess: (updated) => {
      queryClient.setQueryData(settingsKeys.detail, updated);
      setForm((previous) => ({
        ...previous,
        googleClientSecret: '',
        microsoftClientSecret: '',
      }));
      toast(t('settings.server.saved'));
    },
    onError: (saveError) =>
      toast(t('common.saveFailed'), {
        description: message(saveError),
        variant: 'destructive',
      }),
  });

  const update = <K extends keyof ServerFormState>(key: K, value: ServerFormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const settings = query.data;
  const fail = (description: string) =>
    toast(t('common.saveFailed'), { description, variant: 'destructive' });

  const submit = () => {
    if (form.sessionTtlHours < 1 || form.sessionTtlHours > 8760) {
      fail(`${t('settings.server.sessionTtl')}: 1–8760`);
      return;
    }
    if (form.syncIntervalSeconds < 30 || form.syncIntervalSeconds > 86400) {
      fail(`${t('settings.server.syncInterval')}: 30–86400`);
      return;
    }
    if (form.pop3IntervalSeconds < 30 || form.pop3IntervalSeconds > 86400) {
      fail(`${t('settings.server.pop3Interval')}: 30–86400`);
      return;
    }
    if (form.bodyPrefetchMaxBytes < 0 || form.bodyPrefetchMaxBytes > GIB) {
      fail(`${t('settings.server.bodyPrefetch')}: 0–${formatBytes(GIB)}`);
      return;
    }
    if (form.maxAttachmentBytes < MIB || form.maxAttachmentBytes > GIB) {
      fail(`${t('settings.server.maxAttachment')}: 1 MiB–${formatBytes(GIB)}`);
      return;
    }
    const body: SettingsUpdate = {
      sessionTtlHours: form.sessionTtlHours,
      syncIntervalSeconds: form.syncIntervalSeconds,
      pop3IntervalSeconds: form.pop3IntervalSeconds,
      bodyPrefetchMaxBytes: form.bodyPrefetchMaxBytes,
      maxAttachmentBytes: form.maxAttachmentBytes,
      googleClientId: form.googleClientId.trim(),
      microsoftClientId: form.microsoftClientId.trim(),
      logLevel: form.logLevel,
    };
    if (form.googleClientSecret.trim() !== '') {
      body.googleClientSecret = form.googleClientSecret.trim();
    }
    if (form.microsoftClientSecret.trim() !== '') {
      body.microsoftClientSecret = form.microsoftClientSecret.trim();
    }
    save.mutate(body);
  };

  return (
    <div>
      <SettingsSection title={t('settings.server.sessions')}>
        <SettingsRow
          title={t('settings.server.sessionTtl')}
          htmlFor="server-session-ttl"
          control={
            <Input
              id="server-session-ttl"
              type="number"
              min={1}
              max={8760}
              value={form.sessionTtlHours}
              onChange={(event) => update('sessionTtlHours', Number(event.target.value))}
              className="w-28"
            />
          }
        />
        <SettingsDivider />
        <SettingsRow
          title={t('settings.server.syncInterval')}
          htmlFor="server-sync-interval"
          control={
            <Input
              id="server-sync-interval"
              type="number"
              min={30}
              max={86400}
              value={form.syncIntervalSeconds}
              onChange={(event) => update('syncIntervalSeconds', Number(event.target.value))}
              className="w-28"
            />
          }
        />
        <SettingsDivider />
        <SettingsRow
          title={t('settings.server.pop3Interval')}
          htmlFor="server-pop3-interval"
          control={
            <Input
              id="server-pop3-interval"
              type="number"
              min={30}
              max={86400}
              value={form.pop3IntervalSeconds}
              onChange={(event) => update('pop3IntervalSeconds', Number(event.target.value))}
              className="w-28"
            />
          }
        />
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection title={t('settings.server.limits')}>
        <SettingsRow
          title={t('settings.server.bodyPrefetch')}
          description={t('settings.server.bodyPrefetchHint', {
            value: formatBytes(form.bodyPrefetchMaxBytes),
          })}
          htmlFor="server-body-limit"
          control={
            <Input
              id="server-body-limit"
              type="number"
              min={0}
              max={GIB}
              value={form.bodyPrefetchMaxBytes}
              onChange={(event) => update('bodyPrefetchMaxBytes', Number(event.target.value))}
              className="w-36"
            />
          }
        />
        <SettingsDivider />
        <SettingsRow
          title={t('settings.server.maxAttachment')}
          description={t('settings.server.maxAttachmentHint', {
            value: formatBytes(form.maxAttachmentBytes),
          })}
          htmlFor="server-attachment-limit"
          control={
            <Input
              id="server-attachment-limit"
              type="number"
              min={MIB}
              max={GIB}
              value={form.maxAttachmentBytes}
              onChange={(event) => update('maxAttachmentBytes', Number(event.target.value))}
              className="w-36"
            />
          }
        />
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection
        title={t('settings.server.oauth')}
        description={t('settings.server.oauthHint')}
      >
        <SettingsRow
          title={t('settings.server.googleClientId')}
          htmlFor="server-google-client-id"
          control={
            <Input
              id="server-google-client-id"
              value={form.googleClientId}
              onChange={(event) => update('googleClientId', event.target.value)}
              className="w-80"
              spellCheck={false}
            />
          }
        />
        <SettingsDivider />
        <SettingsRow
          title={t('settings.server.googleClientSecret')}
          description={t('settings.server.secretWriteOnly')}
          htmlFor="server-google-client-secret"
          control={
            <div className="flex items-center gap-2">
              <Badge variant={settings.googleSecretSet ? 'secondary' : 'muted'}>
                {settings.googleSecretSet
                  ? t('settings.server.secretSet')
                  : t('settings.server.secretNotSet')}
              </Badge>
              <Input
                id="server-google-client-secret"
                type="password"
                value={form.googleClientSecret}
                onChange={(event) => update('googleClientSecret', event.target.value)}
                placeholder={t('settings.server.secretPlaceholder')}
                className="w-64"
                autoComplete="new-password"
              />
            </div>
          }
        />
        <SettingsDivider />
        <SettingsRow
          title={t('settings.server.microsoftClientId')}
          htmlFor="server-microsoft-client-id"
          control={
            <Input
              id="server-microsoft-client-id"
              value={form.microsoftClientId}
              onChange={(event) => update('microsoftClientId', event.target.value)}
              className="w-80"
              spellCheck={false}
            />
          }
        />
        <SettingsDivider />
        <SettingsRow
          title={t('settings.server.microsoftClientSecret')}
          description={t('settings.server.secretWriteOnly')}
          htmlFor="server-microsoft-client-secret"
          control={
            <div className="flex items-center gap-2">
              <Badge variant={settings.microsoftSecretSet ? 'secondary' : 'muted'}>
                {settings.microsoftSecretSet
                  ? t('settings.server.secretSet')
                  : t('settings.server.secretNotSet')}
              </Badge>
              <Input
                id="server-microsoft-client-secret"
                type="password"
                value={form.microsoftClientSecret}
                onChange={(event) => update('microsoftClientSecret', event.target.value)}
                placeholder={t('settings.server.secretPlaceholder')}
                className="w-64"
                autoComplete="new-password"
              />
            </div>
          }
        />
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection title={t('settings.server.logging')}>
        <SettingsRow
          title={t('settings.server.logLevel')}
          htmlFor="server-log-level"
          control={
            <Select
              value={form.logLevel}
              onValueChange={(value) =>
                update(
                  'logLevel',
                  value === 'debug' || value === 'warn' || value === 'error' ? value : 'info',
                )
              }
            >
              <SelectTrigger id="server-log-level" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['debug', 'info', 'warn', 'error'] as const).map((level) => (
                  <SelectItem key={level} value={level}>
                    {t(`settings.server.logLevels.${level}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      </SettingsSection>

      <SettingsDivider />
      <div className="flex items-center gap-3 pt-4">
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending ? t('common.saving') : t('settings.server.save')}
        </Button>
      </div>
    </div>
  );
}
