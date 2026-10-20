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
import { Textarea } from '@/components/ui/input';
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
  publicUrl: string;
  sessionTtlHours: number;
  syncIntervalSeconds: number;
  pop3IntervalSeconds: number;
  bodyPrefetchMaxBytes: number;
  maxAttachmentBytes: number;
  corsOrigins: string;
  trustedProxies: string;
  insecureAllow: string;
  googleClientId: string;
  microsoftClientId: string;
  googleClientSecret: string;
  microsoftClientSecret: string;
  logLevel: LogLevel;
}

function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

function validPublicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      (url.pathname === '/' || url.pathname === '') &&
      url.search === '' &&
      url.hash === ''
    );
  } catch {
    return false;
  }
}

function validCidr(value: string): boolean {
  const [address, prefix] = value.split('/');
  if (!address || !prefix) return false;
  const bits = Number(prefix);
  if (!Number.isInteger(bits)) return false;
  if (address.includes(':')) {
    return bits >= 0 && bits <= 128 && /^[0-9a-fA-F:]+$/.test(address);
  }
  const octets = address.split('.');
  return (
    bits >= 0 &&
    bits <= 32 &&
    octets.length === 4 &&
    octets.every((octet) => {
      const value = Number(octet);
      return Number.isInteger(value) && value >= 0 && value <= 255;
    })
  );
}

export function ServerSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const message = useErrorMessage();
  const query = useQuery({ queryKey: settingsKeys.detail, queryFn: fetchSettings });
  const [form, setForm] = useState<ServerFormState>({
    publicUrl: '',
    sessionTtlHours: 168,
    syncIntervalSeconds: 60,
    pop3IntervalSeconds: 300,
    bodyPrefetchMaxBytes: 2 * MIB,
    maxAttachmentBytes: 25 * MIB,
    corsOrigins: '',
    trustedProxies: '',
    insecureAllow: '',
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
      publicUrl: settings.publicUrl,
      sessionTtlHours: settings.sessionTtlHours,
      syncIntervalSeconds: settings.syncIntervalSeconds,
      pop3IntervalSeconds: settings.pop3IntervalSeconds,
      bodyPrefetchMaxBytes: settings.bodyPrefetchMaxBytes,
      maxAttachmentBytes: settings.maxAttachmentBytes,
      corsOrigins: settings.corsOrigins.join('\n'),
      trustedProxies: settings.trustedProxies.join('\n'),
      insecureAllow: settings.insecureAllow.join('\n'),
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
  const corsOrigins = lines(form.corsOrigins);
  const trustedProxies = lines(form.trustedProxies);
  const insecureAllow = lines(form.insecureAllow);

  const fail = (description: string) =>
    toast(t('common.saveFailed'), { description, variant: 'destructive' });

  const submit = () => {
    if (form.publicUrl.trim() !== '' && !validPublicUrl(form.publicUrl.trim())) {
      fail(t('settings.server.errors.publicUrl'));
      return;
    }
    if (!corsOrigins.every(validOrigin)) {
      fail(t('settings.server.errors.corsOrigins'));
      return;
    }
    if (!trustedProxies.every(validCidr)) {
      fail(t('settings.server.errors.trustedProxies'));
      return;
    }
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
      publicUrl: form.publicUrl.trim(),
      sessionTtlHours: form.sessionTtlHours,
      syncIntervalSeconds: form.syncIntervalSeconds,
      pop3IntervalSeconds: form.pop3IntervalSeconds,
      bodyPrefetchMaxBytes: form.bodyPrefetchMaxBytes,
      maxAttachmentBytes: form.maxAttachmentBytes,
      corsOrigins: corsOrigins.map((origin) => new URL(origin).origin),
      trustedProxies,
      insecureAllow,
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
      <SettingsSection
        title={t('settings.server.urls')}
        description={t('settings.server.urlsHint')}
      >
        <SettingsRow
          title={t('settings.server.publicUrl')}
          description={t('settings.server.publicUrlHint')}
          htmlFor="server-public-url"
          control={
            <Input
              id="server-public-url"
              value={form.publicUrl}
              onChange={(event) => update('publicUrl', event.target.value)}
              placeholder={t('settings.server.publicUrlPlaceholder')}
              className="w-80"
              spellCheck={false}
            />
          }
        />
        <SettingsDivider />
        <div className="space-y-1.5 py-2">
          <label htmlFor="server-cors" className="text-sm font-medium">
            {t('settings.server.corsOrigins')}
          </label>
          <p className="text-xs text-muted-foreground">{t('settings.server.corsOriginsHint')}</p>
          <Textarea
            id="server-cors"
            value={form.corsOrigins}
            onChange={(event) => update('corsOrigins', event.target.value)}
            placeholder={t('settings.server.corsOriginsPlaceholder')}
            className="min-h-20 font-mono text-xs"
            spellCheck={false}
          />
        </div>
        <SettingsDivider />
        <div className="space-y-1.5 py-2">
          <label htmlFor="server-proxies" className="text-sm font-medium">
            {t('settings.server.trustedProxies')}
          </label>
          <p className="text-xs text-muted-foreground">{t('settings.server.trustedProxiesHint')}</p>
          <Textarea
            id="server-proxies"
            value={form.trustedProxies}
            onChange={(event) => update('trustedProxies', event.target.value)}
            placeholder={t('settings.server.trustedProxiesPlaceholder')}
            className="min-h-20 font-mono text-xs"
            spellCheck={false}
          />
        </div>
        <SettingsDivider />
        <div className="space-y-1.5 py-2">
          <label htmlFor="server-insecure-allow" className="text-sm font-medium">
            {t('settings.server.insecureAllow')}
          </label>
          <p className="text-xs text-muted-foreground">{t('settings.server.insecureAllowHint')}</p>
          <Textarea
            id="server-insecure-allow"
            value={form.insecureAllow}
            onChange={(event) => update('insecureAllow', event.target.value)}
            placeholder={t('settings.server.insecureAllowPlaceholder')}
            className="min-h-20 font-mono text-xs"
            spellCheck={false}
          />
        </div>
      </SettingsSection>

      <SettingsDivider />

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
