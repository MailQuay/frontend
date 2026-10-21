import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  Inbox,
  Mail,
  MailOpen,
  Star,
  Trash2,
  Send,
  Plus,
  CloudOff,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchMailboxTree } from '@/features/mailboxes/api';
import { fetchTasks } from '@/features/tasks/api';
import { cn } from '@/lib/utils';
import { normalizePathname } from '@/lib/routes';
import { useUiStore } from '@/stores/ui';

export type MailView =
  | 'all'
  | 'unread'
  | 'sent'
  | 'sending'
  | 'drafts'
  | 'trash'
  | 'marked'
  | 'archive'
  | 'search'
  | 'folder';

interface FavoriteEntry {
  view: Exclude<MailView, 'search' | 'folder'>;
  href: string;
  label: string;
  icon: typeof Mail;
  count?: number;
}

export function Sidebar({
  currentView,
  onNavigate,
}: {
  currentView: MailView;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const pathname = normalizePathname(useLocation().pathname);
  const treeQuery = useQuery({
    queryKey: ['mailboxes', 'tree'],
    queryFn: fetchMailboxTree,
  });
  const tasksQuery = useQuery({
    queryKey: ['tasks', 'list'],
    queryFn: fetchTasks,
    staleTime: 10_000,
  });

  const expandedAccounts = useUiStore((state) => state.expandedAccounts);
  const toggleAccount = useUiStore((state) => state.toggleAccount);
  const expandedOther = useUiStore((state) => state.expandedOther);
  const toggleOther = useUiStore((state) => state.toggleOther);

  const tree = treeQuery.data;
  const counts = tree?.counts;
  const accounts = tree?.accounts ?? [];
  const activeTasks = (tasksQuery.data ?? []).filter(
    (task) => task.status === 'running' || task.status === 'pending',
  ).length;

  const favorites: FavoriteEntry[] = [
    { view: 'all', href: '/', label: t('nav.all'), icon: Mail, count: counts?.all },
    { view: 'unread', href: '/unread', label: t('nav.unread'), icon: MailOpen, count: counts?.unread },
    { view: 'sent', href: '/sent', label: t('nav.sent'), icon: Send, count: counts?.sent },
    { view: 'sending', href: '/sending', label: t('nav.sending'), icon: Clock3, count: counts?.sending },
    { view: 'drafts', href: '/drafts', label: t('nav.drafts'), icon: FileText, count: counts?.drafts },
    { view: 'trash', href: '/trash', label: t('nav.trash'), icon: Trash2, count: counts?.trash },
  ];
  if ((counts?.marked ?? 0) > 0) {
    favorites.push({
      view: 'marked',
      href: '/marked',
      label: t('nav.marked'),
      icon: Star,
      count: counts?.marked,
    });
  }
  favorites.push({
    view: 'archive',
    href: '/archive',
    label: t('nav.archive'),
    icon: Archive,
  });

  const totalAccounts = accounts.length;
  const connected = accounts.filter((entry) => entry.account.state === 'connected').length;
  const syncing = accounts.some((entry) => entry.account.state === 'syncing');
  const errored = accounts.some((entry) => entry.account.state === 'error');

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-2">
        <div className="h-10 md:hidden" aria-hidden="true" />
        <nav aria-label={t('nav.navigation')} className="space-y-0.5">
          {favorites.map((entry) => {
            const Icon = entry.icon;
            const active = currentView === entry.view;
            return (
              <Link
                key={entry.view}
                to={entry.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-7 items-center gap-2 rounded-lg px-2.5 text-[13px] text-foreground/90 hover:bg-accent hover:text-accent-foreground',
                  active && 'bg-accent font-medium text-accent-foreground',
                )}
              >
                <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                {entry.count !== undefined && entry.count > 0 ? (
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {entry.count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-3 flex items-center justify-between px-2.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('nav.accounts')}
          </span>
          <Link
            to="/settings/accounts"
            aria-label={t('nav.addAccount')}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        {treeQuery.isPending ? (
          <div className="mt-2 space-y-1.5 px-2.5">
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-5/6" />
            <Skeleton className="h-7 w-4/5" />
          </div>
        ) : treeQuery.isError ? (
          <div className="mt-3 px-2">
            <p className="px-1 text-xs text-muted-foreground">{t('common.loadingFailed')}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 w-full justify-start"
              onClick={() => void treeQuery.refetch()}
            >
              <RefreshCw aria-hidden="true" />
              {t('common.retry')}
            </Button>
          </div>
        ) : accounts.length === 0 ? (
          <div className="mt-2 px-2">
            <p className="text-center text-[11px] text-muted-foreground">{t('nav.noAccounts')}</p>
          </div>
        ) : (
          <div className="mt-1.5 space-y-0.5">
            {accounts.map((entry) => {
              const account = entry.account;
              const expanded = expandedAccounts[account.id] ?? false;
              const otherExpanded = expandedOther[account.id] ?? false;
              const unread = entry.folders.reduce((sum, folder) => sum + folder.unread, 0);
              const inbox = entry.folders.find((folder) => folder.role === 'inbox');
              const sent = entry.folders.find((folder) => folder.role === 'sent');
              const drafts = entry.folders.find((folder) => folder.role === 'drafts');
              const trash = entry.folders.find((folder) => folder.role === 'trash');
              return (
                <div key={account.id}>
                  <button
                    type="button"
                    onClick={() => toggleAccount(account.id)}
                    aria-expanded={expanded}
                    aria-label={
                      expanded
                        ? t('nav.collapseAccount', { email: account.email })
                        : t('nav.expandAccount', { email: account.email })
                    }
                    className={cn(
                      'flex min-h-7 w-full items-center gap-1.5 rounded-lg px-2.5 text-left text-[13px] hover:bg-accent hover:text-accent-foreground',
                      expanded && 'bg-accent/60',
                    )}
                  >
                    {expanded ? (
                      <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{account.email}</span>
                    {unread > 0 ? (
                      <span className="text-[11px] tabular-nums text-muted-foreground">{unread}</span>
                    ) : null}
                  </button>
                  {expanded ? (
                    <div className="ml-3 mt-0.5 space-y-0.5 border-l pl-2">
                      {inbox ? (
                        <Link
                          to={`/accounts/${account.id}/mailboxes/${inbox.id}`}
                          onClick={onNavigate}
                          className={cn(
                            'flex min-h-7 items-center gap-2 rounded-md px-2 text-[13px] hover:bg-accent hover:text-accent-foreground',
                            pathname === `/accounts/${account.id}/mailboxes/${inbox.id}` &&
                              'bg-accent font-medium text-accent-foreground',
                          )}
                        >
                          <Inbox className="size-3.5 text-muted-foreground" aria-hidden="true" />
                          <span className="flex-1 truncate">{t('nav.inbox')}</span>
                          {inbox.unread > 0 ? (
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              {inbox.unread}
                            </span>
                          ) : null}
                        </Link>
                      ) : null}
                      {inbox ? (
                        <Link
                          to={`/accounts/${account.id}/mailboxes/${inbox.id}?view=unread`}
                          onClick={onNavigate}
                          className="flex min-h-7 items-center gap-2 rounded-md px-2 text-[13px] hover:bg-accent hover:text-accent-foreground"
                        >
                          <MailOpen className="size-3.5 text-muted-foreground" aria-hidden="true" />
                          <span className="flex-1 truncate">{t('nav.unread')}</span>
                        </Link>
                      ) : null}
                      {sent ? (
                        <Link
                          to={`/accounts/${account.id}/mailboxes/${sent.id}`}
                          onClick={onNavigate}
                          className="flex min-h-7 items-center gap-2 rounded-md px-2 text-[13px] hover:bg-accent hover:text-accent-foreground"
                        >
                          <Send className="size-3.5 text-muted-foreground" aria-hidden="true" />
                          <span className="flex-1 truncate">{t('nav.sent')}</span>
                        </Link>
                      ) : null}
                      {drafts ? (
                        <Link
                          to={`/accounts/${account.id}/mailboxes/${drafts.id}`}
                          onClick={onNavigate}
                          className="flex min-h-7 items-center gap-2 rounded-md px-2 text-[13px] hover:bg-accent hover:text-accent-foreground"
                        >
                          <FileText className="size-3.5 text-muted-foreground" aria-hidden="true" />
                          <span className="flex-1 truncate">{t('nav.drafts')}</span>
                        </Link>
                      ) : null}
                      {trash ? (
                        <Link
                          to={`/accounts/${account.id}/mailboxes/${trash.id}`}
                          onClick={onNavigate}
                          className="flex min-h-7 items-center gap-2 rounded-md px-2 text-[13px] hover:bg-accent hover:text-accent-foreground"
                        >
                          <Trash2 className="size-3.5 text-muted-foreground" aria-hidden="true" />
                          <span className="flex-1 truncate">{t('nav.trash')}</span>
                        </Link>
                      ) : null}
                      <Collapsible open={otherExpanded} onOpenChange={() => toggleOther(account.id)}>
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            aria-expanded={otherExpanded}
                            aria-label={
                              otherExpanded
                                ? t('nav.collapseSection', { name: t('nav.other') })
                                : t('nav.expandSection', { name: t('nav.other') })
                            }
                            className="flex min-h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          >
                            {otherExpanded ? (
                              <ChevronDown className="size-3.5" aria-hidden="true" />
                            ) : (
                              <ChevronRight className="size-3.5" aria-hidden="true" />
                            )}
                            <span className="flex-1 truncate text-left">{t('nav.other')}</span>
                            {entry.other.length > 0 ? (
                              <Badge variant="muted">{entry.other.length}</Badge>
                            ) : null}
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-2 space-y-0.5 border-l pl-2">
                            {entry.other.length === 0 ? (
                              <p className="px-2 py-1 text-xs text-muted-foreground">
                                {t('common.none')}
                              </p>
                            ) : (
                              entry.other.map((folder) => (
                                <Link
                                  key={folder.id}
                                  to={`/accounts/${account.id}/mailboxes/${folder.id}`}
                                  onClick={onNavigate}
                                  className={cn(
                                    'flex min-h-7 items-center gap-2 rounded-md px-2 text-[13px] hover:bg-accent hover:text-accent-foreground',
                                    pathname ===
                                      `/accounts/${account.id}/mailboxes/${folder.id}` &&
                                      'bg-accent font-medium text-accent-foreground',
                                  )}
                                >
                                  <Archive
                                    className="size-3.5 text-muted-foreground"
                                    aria-hidden="true"
                                  />
                                  <span className="flex-1 truncate">{folder.name}</span>
                                  {folder.unread > 0 ? (
                                    <span className="text-[11px] tabular-nums text-muted-foreground">
                                      {folder.unread}
                                    </span>
                                  ) : null}
                                </Link>
                              ))
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t px-2 py-1.5">
        <div className="flex items-center gap-2 px-2.5 py-1 text-[11px] text-muted-foreground">
          {treeQuery.isPending ? (
            <span>{t('common.loading')}</span>
          ) : errored ? (
            <>
              <AlertTriangle className="size-3.5 text-destructive" aria-hidden="true" />
              <span>{t('nav.sync.error')}</span>
            </>
          ) : syncing || activeTasks > 0 ? (
            <>
              <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
              <span>
                {t('nav.sync.syncing')}
                {activeTasks > 0
                  ? ` · ${t('nav.sync.activeTasks', { count: activeTasks })}`
                  : ''}
              </span>
            </>
          ) : totalAccounts === 0 ? (
            <>
              <CloudOff className="size-3.5" aria-hidden="true" />
              <span>{t('nav.noAccounts')}</span>
            </>
          ) : (
            <>
              <span
                className="size-1.5 rounded-full bg-task-sync"
                aria-hidden="true"
              />
              <span>{t('nav.sync.summary', { connected, total: totalAccounts })}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
