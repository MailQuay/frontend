import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, RefreshCw } from 'lucide-react';
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
  detectConcurrency,
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
import { InlineWarning } from '@/components/layout/InsecureTransportBanner';

interface ConcurrencyForm {
  mode: NonNullable<SettingsUpdate['concurrencyMode']>;
  syncConcurrency: number;
  fetchConcurrency: number;
  searchConcurrency: number;
  indexBatchSize: number;
}

export function PerformanceSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const message = useErrorMessage();
  const query = useQuery({ queryKey: settingsKeys.detail, queryFn: fetchSettings });
  const [form, setForm] = useState<ConcurrencyForm>({
    mode: 'auto',
    syncConcurrency: 2,
    fetchConcurrency: 4,
    searchConcurrency: 2,
    indexBatchSize: 100,
  });

  useEffect(() => {
    if (!query.data) return;
    setForm({
      mode: query.data.concurrency.mode,
      syncConcurrency: query.data.concurrency.syncConcurrency,
      fetchConcurrency: query.data.concurrency.fetchConcurrency,
      searchConcurrency: query.data.concurrency.searchConcurrency,
      indexBatchSize: query.data.concurrency.indexBatchSize,
    });
  }, [query.data]);

  const detect = useMutation({
    mutationFn: detectConcurrency,
    onSuccess: () => {
      toast(t('settings.performance.redetected'));
      void queryClient.invalidateQueries({ queryKey: settingsKeys.detail });
    },
    onError: (detectError) =>
      toast(t('common.updateFailed'), {
        description: message(detectError),
        variant: 'destructive',
      }),
  });

  const save = useMutation({
    mutationFn: (body: SettingsUpdate) => updateSettings(body),
    onSuccess: (updated) => {
      queryClient.setQueryData(settingsKeys.detail, updated);
      toast(t('settings.performance.saved'));
    },
    onError: (saveError) =>
      toast(t('common.saveFailed'), {
        description: message(saveError),
        variant: 'destructive',
      }),
  });

  const update = <K extends keyof ConcurrencyForm>(key: K, value: ConcurrencyForm[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const settings = query.data;
  const resources = settings.resources;
  const memoryBudget = form.fetchConcurrency * 128 * 1024 * 1024 + 256 * 1024 * 1024;
  const exceedsBudget = form.mode === 'manual' && memoryBudget > resources.memoryBytes;

  const fail = (description: string) =>
    toast(t('common.saveFailed'), { description, variant: 'destructive' });

  const submit = () => {
    if (form.syncConcurrency < 1 || form.syncConcurrency > 32) {
      fail(`${t('settings.performance.syncConcurrency')}: 1–32`);
      return;
    }
    if (form.fetchConcurrency < 1 || form.fetchConcurrency > 32) {
      fail(`${t('settings.performance.fetchConcurrency')}: 1–32`);
      return;
    }
    if (form.searchConcurrency < 1 || form.searchConcurrency > 32) {
      fail(`${t('settings.performance.searchConcurrency')}: 1–32`);
      return;
    }
    if (form.indexBatchSize < 50 || form.indexBatchSize > 500) {
      fail(`${t('settings.performance.indexBatchSize')}: 50–500`);
      return;
    }
    save.mutate({
      concurrencyMode: form.mode,
      syncConcurrency: form.syncConcurrency,
      fetchConcurrency: form.fetchConcurrency,
      searchConcurrency: form.searchConcurrency,
      indexBatchSize: form.indexBatchSize,
    });
  };

  return (
    <div>
      <SettingsSection
        title={t('settings.performance.detected')}
        description={`${resources.cpuSource} · ${resources.memorySource}`}
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <MetricCard label={t('settings.performance.cpus')} value={String(resources.cpus)} />
          <MetricCard
            label={t('settings.performance.memory')}
            value={formatBytes(resources.memoryBytes)}
          />
          <MetricCard
            label={t('settings.performance.cgroup')}
            value={t('settings.performance.cgroupValue', { version: resources.cgroupVersion })}
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => detect.mutate()}
            disabled={detect.isPending}
          >
            {detect.isPending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden="true" />
            )}
            {t('settings.performance.redetect')}
          </Button>
        </div>
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection title={t('settings.performance.autoValues')}>
        <div className="grid gap-2 text-xs sm:grid-cols-2">
          <ReadOnlyValue
            label={t('settings.performance.syncConcurrency')}
            value={resources.auto.syncConcurrency}
          />
          <ReadOnlyValue
            label={t('settings.performance.fetchConcurrency')}
            value={resources.auto.fetchConcurrency}
          />
          <ReadOnlyValue
            label={t('settings.performance.searchConcurrency')}
            value={resources.auto.searchConcurrency}
          />
          <ReadOnlyValue
            label={t('settings.performance.indexBatchSize')}
            value={resources.auto.indexBatchSize}
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {t('settings.performance.effectiveValues')}: {settings.concurrency.mode} ·{' '}
          {settings.concurrency.syncConcurrency}/{settings.concurrency.fetchConcurrency}/
          {settings.concurrency.searchConcurrency}/{settings.concurrency.indexBatchSize}
        </p>
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection title={t('settings.performance.mode')}>
        <SettingsRow
          title={t('settings.performance.mode')}
          htmlFor="performance-mode"
          control={
            <Select
              value={form.mode}
              onValueChange={(value) => update('mode', value === 'manual' ? 'manual' : 'auto')}
            >
              <SelectTrigger id="performance-mode" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{t('settings.performance.modeAuto')}</SelectItem>
                <SelectItem value="manual">{t('settings.performance.modeManual')}</SelectItem>
              </SelectContent>
            </Select>
          }
        />
        <SettingsDivider />
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            id="performance-sync"
            label={t('settings.performance.syncConcurrency')}
            value={form.syncConcurrency}
            min={1}
            max={32}
            disabled={form.mode === 'auto'}
            onChange={(value) => update('syncConcurrency', value)}
          />
          <NumberField
            id="performance-fetch"
            label={t('settings.performance.fetchConcurrency')}
            value={form.fetchConcurrency}
            min={1}
            max={32}
            disabled={form.mode === 'auto'}
            onChange={(value) => update('fetchConcurrency', value)}
          />
          <NumberField
            id="performance-search"
            label={t('settings.performance.searchConcurrency')}
            value={form.searchConcurrency}
            min={1}
            max={32}
            disabled={form.mode === 'auto'}
            onChange={(value) => update('searchConcurrency', value)}
          />
          <NumberField
            id="performance-index"
            label={t('settings.performance.indexBatchSize')}
            value={form.indexBatchSize}
            min={50}
            max={500}
            disabled={form.mode === 'auto'}
            onChange={(value) => update('indexBatchSize', value)}
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {t('settings.performance.manualHint')}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {t('settings.performance.memoryBudget')}: {formatBytes(memoryBudget)}
        </p>
        {exceedsBudget ? (
          <InlineWarning className="mt-2">{t('settings.performance.warning')}</InlineWarning>
        ) : null}
      </SettingsSection>

      <SettingsDivider />
      <div className="flex items-center gap-3 pt-4">
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending ? t('common.saving') : t('settings.performance.save')}
        </Button>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

function ReadOnlyValue({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium">
        {label}
      </label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}
