import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Paperclip, Star } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/States';
import { formatListDate, initials } from '@/lib/format';
import { accountColorValue } from '@/lib/accountColor';
import { cn } from '@/lib/utils';
import type { MessageSummary } from './api';

const ROW_HEIGHT = 88;
const OVERSCAN = 5;

export function MessageList({
  title,
  messages,
  isLoading,
  isError,
  error,
  onRetry,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  selectedId,
  onSelect,
  showAccountBadge,
  emptyTitle,
  emptyBody,
  errorTitle,
}: {
  title: string;
  messages: MessageSummary[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  showAccountBadge: boolean;
  emptyTitle: string;
  emptyBody: string;
  errorTitle?: string;
}) {
  const { t, i18n } = useTranslation();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setViewportHeight(node.clientHeight));
    observer.observe(node);
    setViewportHeight(node.clientHeight);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setScrollTop(0);
  }, [title]);

  const total = messages.length;
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(
    total,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN,
  );
  const visible = useMemo(() => messages.slice(start, end), [end, messages, start]);
  const totalHeight = total * ROW_HEIGHT;

  const handleScroll = () => {
    const node = scrollRef.current;
    if (!node) return;
    setScrollTop(node.scrollTop);
    if (
      hasNextPage &&
      !isFetchingNextPage &&
      node.scrollTop + node.clientHeight >= node.scrollHeight - 480
    ) {
      onLoadMore();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {isLoading ? (
        <div className="space-y-0 p-2">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="flex items-start gap-3 px-2 py-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-2.5 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={onRetry} title={errorTitle ?? t('mail.errorTitle')} />
      ) : messages.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyBody} />
      ) : (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="scrollbar-thin min-h-0 flex-1 overflow-y-auto"
          aria-label={t('mail.messageList')}
        >
          <div style={{ height: totalHeight, position: 'relative' }}>
            {visible.map((message, index) => {
              const absoluteIndex = start + index;
              const sender = message.from?.name || message.from?.email || '';
              const isSelected = selectedId === message.id;
              return (
                <div
                  key={message.id}
                  style={{
                    position: 'absolute',
                    top: absoluteIndex * ROW_HEIGHT,
                    left: 0,
                    right: 0,
                    height: ROW_HEIGHT,
                  }}
                  className={cn(
                    'flex items-start gap-2 border-b px-2 py-2 transition-colors md:px-3',
                    isSelected ? 'bg-accent' : 'hover:bg-accent/60',
                    message.unread && !isSelected && 'bg-muted/20',
                  )}
                >
                  <div className="flex h-[72px] min-w-0 flex-1 items-center">
                    <button
                      type="button"
                      onClick={() => onSelect(message.id)}
                      aria-label={t('mail.openMessage', { sender })}
                      aria-current={isSelected ? 'true' : undefined}
                      className="flex h-full w-full min-w-0 items-center gap-2.5 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="relative shrink-0">
                        <Avatar className="size-8 border">
                          <AvatarFallback>{initials(sender)}</AvatarFallback>
                        </Avatar>
                        {message.unread ? (
                          <span
                            className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-background bg-primary"
                            aria-hidden="true"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span
                            className={cn(
                              'min-w-0 flex-1 truncate text-sm',
                              message.unread && 'font-semibold',
                            )}
                          >
                            {sender || t('common.unknown')}
                          </span>
                          <time
                            className="shrink-0 text-[11px] text-muted-foreground"
                            dateTime={message.receivedAt ?? message.sentAt}
                          >
                            {formatListDate(
                              message.receivedAt ?? message.sentAt,
                              i18n.language,
                              undefined,
                            )}
                          </time>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span
                            className={cn(
                              'min-w-0 flex-1 truncate text-[13px]',
                              message.unread ? 'font-medium' : 'text-foreground/90',
                            )}
                          >
                            {message.subject || t('drafting.noSubject')}
                          </span>
                          {message.hasAttachments ? (
                            <Paperclip className="size-3 shrink-0 text-muted-foreground" aria-label={t('mail.hasAttachments')} />
                          ) : null}
                          {message.marked ? (
                            <Star className="size-3 shrink-0 fill-current text-foreground" aria-label={t('mail.markedIndicator')} />
                          ) : null}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                            {message.snippet || ''}
                          </span>
                        </div>
                        {showAccountBadge ? (
                          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span
                              className="size-1.5 rounded-full"
                              style={{ backgroundColor: accountColorValue(message.accountColor) }}
                              aria-hidden="true"
                            />
                            <span className="truncate">
                              {message.accountName || message.accountEmail}
                            </span>
                            {message.preserved ? (
                              <Badge variant="outline" className="ml-1 px-1 py-0 text-[9px]">
                                {t('mail.preservedIndicator')}
                              </Badge>
                            ) : null}
                            {message.isArchive ? (
                              <Badge variant="outline" className="ml-1 px-1 py-0 text-[9px]">
                                {t('mail.archivedIndicator')}
                              </Badge>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {hasNextPage ? (
            <div className="flex items-center justify-center border-t p-3">
              <Button
                variant="outline"
                size="sm"
                onClick={onLoadMore}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? t('mail.loadingMore') : t('mail.loadMore')}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
