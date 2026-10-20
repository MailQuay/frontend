import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
  Menu,
  PenLine,
  RefreshCw,
  Search,
  X,
  MoreHorizontal,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TaskRing } from '@/features/tasks/TaskRing';
import { useComposeLauncher } from '@/features/compose/useComposeLauncher';
import { useSearchStore } from '@/stores/search';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

export function TopBar({ onOpenNav }: { onOpenNav: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { launch } = useComposeLauncher();
  const setQuery = useSearchStore((state) => state.setQuery);
  const applySearch = useSearchStore((state) => state.apply);
  const currentQuery = useSearchStore((state) => state.filters.q);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQueryValue] = useState(currentQuery);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setQuery(query.trim());
    applySearch();
    navigate('/search');
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries();
    } finally {
      window.setTimeout(() => setRefreshing(false), 400);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur md:h-16 md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label={t('nav.openMenu')}
        onClick={onOpenNav}
      >
        <Menu className="size-4" aria-hidden="true" />
      </Button>

      <Button onClick={() => void launch({ mode: 'new' })} size="sm" className="gap-2 md:h-9">
        <PenLine className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">{t('topbar.compose')}</span>
        <span className="sr-only sm:hidden">{t('topbar.compose')}</span>
      </Button>

      <div className="flex-1" />

      <div className="relative flex items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('topbar.search')}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((open) => !open)}
            >
              <Search className="size-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('topbar.search')}</TooltipContent>
        </Tooltip>
        {searchOpen ? (
          <form
            onSubmit={submitSearch}
            className="absolute right-0 top-[calc(100%+0.5rem)] z-40 flex w-[min(28rem,calc(100vw-2rem))] items-center gap-2 rounded-lg border bg-popover p-2 shadow-lg"
            role="search"
          >
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => setQueryValue(event.target.value)}
              placeholder={t('topbar.searchPlaceholder')}
              aria-label={t('topbar.search')}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setSearchOpen(false);
              }}
            />
            <Button type="submit" size="sm">
              {t('topbar.submitSearch')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('topbar.closeSearch')}
              onClick={() => setSearchOpen(false)}
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </form>
        ) : null}
      </div>

      <div className="hidden md:flex">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('topbar.refresh')}
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              <RefreshCw className={refreshing ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('topbar.refresh')}</TooltipContent>
        </Tooltip>
      </div>

      <TaskRing />

      <div className="hidden md:flex">
        <ThemeToggle />
      </div>

      <UserMenu />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label={t('common.more')}>
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void refresh()} disabled={refreshing}>
            <RefreshCw aria-hidden="true" />
            {t('topbar.refresh')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setSearchOpen(true)}>
            <Search aria-hidden="true" />
            {t('topbar.search')}
          </DropdownMenuItem>
          <div className="border-t px-1 pt-1">
            <ThemeToggle />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
