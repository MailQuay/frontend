import { useMutation, useQuery } from '@tanstack/react-query';
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
import { useAuthStatus } from '@/hooks/useAuth';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { updateProfile } from '@/features/auth/api';
import { fetchSettings, settingsKeys, updateSettings } from '@/features/settings/api';
import {
  SettingsDivider,
  SettingsRow,
  SettingsSection,
} from '@/features/settings/SettingsSection';
import { applyLanguage, SUPPORTED_LANGUAGES } from '@/lib/i18n';
import { applyThemeClass, useUiStore, type ThemePreference } from '@/stores/ui';
import type { SupportedLanguage } from '@/lib/i18n';

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function themeValue(value: string | undefined): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export function PreferencesSettingsPage() {
  const { t } = useTranslation();
  const auth = useAuthStatus();
  const settingsQuery = useQuery({ queryKey: settingsKeys.detail, queryFn: fetchSettings });
  const message = useErrorMessage();
  const setTheme = useUiStore((state) => state.setTheme);
  const gravatarAvatars = useUiStore((state) => state.gravatarAvatars);
  const setGravatarAvatars = useUiStore((state) => state.setGravatarAvatars);
  const networkAvatars = useUiStore((state) => state.networkAvatars);
  const setNetworkAvatars = useUiStore((state) => state.setNetworkAvatars);
  const [theme, setThemeValue] = useState<ThemePreference>('system');
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  const [timezone, setTimezone] = useState('');

  const user = auth.data?.user;
  const settings = settingsQuery.data;

  useEffect(() => {
    if (user?.theme) setThemeValue(themeValue(user.theme));
  }, [user?.theme]);
  useEffect(() => {
    if (user?.locale) setLanguage(user.locale.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en');
  }, [user?.locale]);
  useEffect(() => {
    if (settings?.language) setLanguage(settings.language);
  }, [settings?.language]);
  useEffect(() => {
    if (settings?.timezone) setTimezone(settings.timezone);
  }, [settings?.timezone]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error(t('errors.unauthorized'));
      const profile = await updateProfile({
        displayName: user.displayName,
        locale: language,
        theme,
      });
      const updated = await updateSettings({
        language,
        timezone: timezone.trim(),
      });
      return { profile, updated };
    },
    onSuccess: () => {
      setTheme(theme);
      applyThemeClass(theme);
      applyLanguage(language);
      toast(t('settings.preferences.saved'));
      void auth.refetch();
      void settingsQuery.refetch();
    },
    onError: (saveError) =>
      toast(t('common.saveFailed'), {
        description: message(saveError),
        variant: 'destructive',
      }),
  });

  const runSave = () => {
    if (timezone.trim() !== '' && !isValidTimeZone(timezone.trim())) {
      toast(t('common.saveFailed'), {
        description: t('settings.preferences.timezoneInvalid'),
        variant: 'destructive',
      });
      return;
    }
    save.mutate();
  };

  return (
    <div>
      <SettingsSection
        title={t('settings.preferences.appearance')}
        description={t('settings.preferences.appearanceHint')}
      >
        <SettingsRow
          title={t('common.theme')}
          htmlFor="settings-theme"
          control={
            <Select
              value={theme}
              onValueChange={(value) => {
                setThemeValue(themeValue(value));
              }}
            >
              <SelectTrigger id="settings-theme" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">{t('settings.preferences.themeOptions.light')}</SelectItem>
                <SelectItem value="dark">{t('settings.preferences.themeOptions.dark')}</SelectItem>
                <SelectItem value="system">{t('settings.preferences.themeOptions.system')}</SelectItem>
              </SelectContent>
            </Select>
          }
        />
        <SettingsDivider />
        <SettingsRow
          title={t('common.language')}
          description={t('settings.preferences.languageHint')}
          htmlFor="settings-language"
          control={
            <Select
              value={language}
              onValueChange={(value) => {
                setLanguage(value as SupportedLanguage);
              }}
            >
              <SelectTrigger id="settings-language" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {t(`settings.languageNames.${entry}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
        <SettingsDivider />
        <SettingsRow
          title={t('settings.preferences.networkAvatars')}
          description={t('settings.preferences.networkAvatarsHint')}
          htmlFor="settings-network-avatars"
          control={
            <Switch
              id="settings-network-avatars"
              checked={networkAvatars}
              onCheckedChange={setNetworkAvatars}
            />
          }
        />
        <SettingsRow
          className="ml-2 border-l pl-4"
          title={t('settings.preferences.gravatarAvatars')}
          description={t('settings.preferences.gravatarAvatarsHint')}
          htmlFor="settings-gravatar-avatars"
          control={
            <Switch
              id="settings-gravatar-avatars"
              checked={gravatarAvatars}
              onCheckedChange={setGravatarAvatars}
              disabled={!networkAvatars}
            />
          }
        />
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection
        title={t('common.timezone')}
        description={t('settings.preferences.timezoneHint')}
      >
        <SettingsRow
          title={t('settings.preferences.timezoneFormat')}
          htmlFor="settings-timezone"
          control={
            <Input
              id="settings-timezone"
              className="w-64"
              value={timezone}
              onChange={(event) => {
                setTimezone(event.target.value);
              }}
              placeholder={t('settings.preferences.timezonePlaceholder')}
              spellCheck={false}
            />
          }
        />
      </SettingsSection>

      <SettingsDivider />
      <div className="flex items-center gap-3 pt-4">
        <Button onClick={runSave} disabled={save.isPending || !user}>
          {save.isPending ? t('common.saving') : t('settings.preferences.save')}
        </Button>
      </div>
    </div>
  );
}
