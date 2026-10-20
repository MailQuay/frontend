import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Identity } from '@/features/identities/api';
import type { IdentityGroup } from './identities';

export function IdentityPicker({
  groups,
  value,
  onSelect,
  children,
}: {
  groups: IdentityGroup[];
  value: Identity | null;
  onSelect: (identity: Identity) => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLowerCase();

  const matchingGroups = groups
    .map((group) => ({
      ...group,
      identities: group.identities.filter((identity) => {
        if (!normalized) return true;
        return (
          identity.email.toLowerCase().includes(normalized) ||
          identity.name.toLowerCase().includes(normalized) ||
          group.account.email.toLowerCase().includes(normalized)
        );
      }),
    }))
    .filter((group) => group.identities.length > 0);

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('compose.identitySearch')}
              aria-label={t('compose.identitySearch')}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
        <div className="scrollbar-thin max-h-72 overflow-y-auto p-1" role="listbox" aria-label={t('compose.chooseIdentity')}>
          {matchingGroups.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {t('compose.identityEmpty')}
            </p>
          ) : (
            matchingGroups.map((group) => (
              <div key={group.account.id} className="mb-1">
                <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t('compose.identityGroup', { email: group.account.email })}
                </p>
                {group.identities.map((identity) => {
                  const selected =
                    value?.accountId === identity.accountId && value.email === identity.email;
                  return (
                    <button
                      key={`${identity.accountId}:${identity.email}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => onSelect(identity)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                        selected && 'bg-accent/70',
                      )}
                    >
                      <span className="flex size-4 items-center justify-center">
                        {selected ? <Check className="size-3.5" aria-hidden="true" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px]">
                          {identity.name ? `${identity.name} <${identity.email}>` : identity.email}
                        </span>
                      </span>
                      {identity.isDefault ? (
                        <Badge variant="muted" className="px-1 py-0 text-[9px]">
                          {t('identity.defaultBadge')}
                        </Badge>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="flex items-center justify-between border-t px-2 py-1.5 text-[11px] text-muted-foreground">
          <span>{t('identity.description')}</span>
          <ChevronDown className="size-3" aria-hidden="true" />
        </div>
      </PopoverContent>
    </Popover>
  );
}
