import { useEffect, useState } from 'react';
import { MailSplit } from '@/components/layout/MailSplit';
import { MessageList } from './MessageList';
import { MessageReader } from '@/features/message-view/MessageReader';
import { useComposeLauncher } from '@/features/compose/useComposeLauncher';
import { ArchiveReader } from '@/features/archive/ArchivePage';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useUiStore } from '@/stores/ui';
import type { MessageSummary } from './api';

export interface WorkspaceQuery {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

export function MessagesWorkspace({
  title,
  messages,
  query,
  showAccountBadge,
  emptyTitle,
  emptyBody,
  readOnly = false,
  errorTitle,
}: {
  title: string;
  messages: MessageSummary[];
  query: WorkspaceQuery;
  showAccountBadge: boolean;
  emptyTitle: string;
  emptyBody: string;
  readOnly?: boolean;
  errorTitle?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const setMobilePane = useUiStore((state) => state.setMobilePane);
  const { launch } = useComposeLauncher();
  useDocumentTitle(title);
  const selectedMessage = messages.find((message) => message.id === selectedId);
  const selectedIsArchive = selectedMessage?.isArchive === true;

  useEffect(() => {
    if (!selectedId) return;
    if (query.isPending) return;
    if (messages.some((message) => message.id === selectedId)) return;
    setSelectedId(null);
  }, [messages, query.isPending, selectedId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.matches('input, textarea, select, [contenteditable="true"]') ||
          target.closest('[role="dialog"]') !== null)
      ) {
        return;
      }
      if (document.querySelector('[role="dialog"], [role="listbox"], [role="menu"]')) return;
      const key = event.key.toLowerCase();
      if (key === 'j' || key === 'arrowdown') {
        event.preventDefault();
        const index = messages.findIndex((message) => message.id === selectedId);
        const next = messages[Math.min(messages.length - 1, index + 1)];
        if (next) {
          setSelectedId(next.id);
          setMobilePane('reader');
        }
      } else if (key === 'k' || key === 'arrowup') {
        event.preventDefault();
        const index = messages.findIndex((message) => message.id === selectedId);
        const previous = messages[Math.max(0, (index === -1 ? 0 : index) - 1)];
        if (previous) {
          setSelectedId(previous.id);
          setMobilePane('reader');
        }
      } else if (event.key === 'Escape') {
        setSelectedId(null);
        setMobilePane('list');
      } else if (key === 'c') {
        event.preventDefault();
        void launch({ mode: 'new' });
      } else if (event.key === '/') {
        event.preventDefault();
        document.getElementById('global-search-trigger')?.click();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [launch, messages, selectedId, setMobilePane]);

  return (
    <MailSplit
      hasSelection={selectedId !== null}
      list={
        <MessageList
          title={title}
          messages={messages}
          isLoading={query.isPending}
          isError={query.isError}
          error={query.error}
          onRetry={() => query.refetch()}
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          onLoadMore={() => query.fetchNextPage()}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setMobilePane('reader');
          }}
          showAccountBadge={showAccountBadge}
          emptyTitle={emptyTitle}
          emptyBody={emptyBody}
          errorTitle={errorTitle}
        />
      }
      reader={
        selectedId ? (
          selectedIsArchive ? (
            <ArchiveReader
              key={selectedId}
              archiveId={selectedId}
              onBack={() => {
                setSelectedId(null);
                setMobilePane('list');
              }}
            />
          ) : (
            <MessageReader
              key={selectedId}
              messageId={selectedId}
              readOnly={readOnly}
              onCloseMobile={() => {
                setSelectedId(null);
                setMobilePane('list');
              }}
              onDeleted={() => {
                setSelectedId(null);
                setMobilePane('list');
              }}
            />
          )
        ) : null
      }
    />
  );
}
