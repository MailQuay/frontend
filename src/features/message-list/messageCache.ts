import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
import type { MessagePage, MessageSummary } from './api';

export type MessageListCache = InfiniteData<MessagePage>;
export type MessageUpdater = (message: MessageSummary) => MessageSummary | null;

const MESSAGE_LIST_PREDICATE = (query: { queryKey: QueryKey }) =>
  Array.isArray(query.queryKey) &&
  query.queryKey[0] === 'messages' &&
  (query.queryKey[1] === 'list' || query.queryKey[1] === 'multi');

export function patchMessageCaches(queryClient: QueryClient, updater: MessageUpdater): void {
  queryClient.setQueriesData<MessageListCache>(
    { predicate: MESSAGE_LIST_PREDICATE },
    (data) => {
      if (!data) return data;
      return {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          messages: page.messages
            .map((message) => updater(message))
            .filter((message): message is MessageSummary => message !== null),
        })),
      };
    },
  );
}
