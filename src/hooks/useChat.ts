// Live chat for an event or a Section: simulated fans plus your own messages,
// with blocked people and reported messages filtered out.
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { getEventBotChat, getSectionBotChat } from '@/data/api';
import type { ChatMessage } from '@/data/types';
import { useUserStore } from '@/store/user';

export function useChat(threadId: string) {
  const [kind, id] = threadId.split(':') as ['event' | 'section', string];
  const bots = useQuery({
    queryKey: ['chat', threadId],
    queryFn: () => Promise.resolve(kind === 'event' ? getEventBotChat(id, Date.now()) : getSectionBotChat(id, Date.now())),
    refetchInterval: 3000,
  });
  const profile = useUserStore((s) => s.profile);
  const mine = useUserStore((s) => s.messages);
  const blocked = useUserStore((s) => s.blocked);
  const hidden = useUserStore((s) => s.hiddenMessages);
  const reactions = useUserStore((s) => s.reactions);

  const messages = useMemo<ChatMessage[]>(() => {
    const own: ChatMessage[] = mine
      .filter((m) => m.threadId === threadId && !m.deleted)
      .map((m) => ({ id: m.id, threadId, userId: 'me', username: profile.username, displayName: profile.displayName,
        avatarSeed: profile.avatarSeed, body: m.body, at: m.at, playId: null, isMine: true, reactions: {} }));
    const all = [...own, ...(bots.data ?? [])]
      .filter((m) => !blocked.includes(m.userId) && !hidden.includes(m.id))
      .map((m) => {
        const my = reactions[m.id];
        if (!my) return m;
        return { ...m, reactions: { ...m.reactions, [my]: (m.reactions[my] ?? 0) + 1 } };
      });
    return all.sort((a, b) => b.at - a.at);
  }, [mine, bots.data, blocked, hidden, reactions, profile, threadId]);

  return { messages, isLoading: bots.isLoading, isError: bots.isError, refetch: bots.refetch };
}
