// Live chat for an event or a Section: simulated fans plus your own messages
// (and the stands answering back), with blocked people and reported messages
// filtered out. Refreshes about every second while a game is live.
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { echoesFor, getEventChat, getSectionChat, type ChatEntry, type ChatSnapshot } from '@/data/api';
import { currentTime } from '@/lib/format';
import { useUserStore } from '@/store/user';

const asPromise = <T,>(fn: () => T) => new Promise<T>((resolve, reject) => {
  try { resolve(fn()); } catch (e) { reject(e); }
});

function refreshEvery(data: ChatSnapshot | null | undefined): number {
  if (!data) return 3000;
  if (data.phase === 'live') return 1200;
  if (data.phase === 'pre') return 2500;
  if (data.phase === 'section') return 3000;
  return 5000;
}

export interface ChatState {
  messages: ChatEntry[];
  typing: string[];
  phase: ChatSnapshot['phase'];
  live: boolean;
  watchers: number | null;
  chatters: number;
  members: number | null;
  hype: ChatSnapshot['hype'];
  updatedAt: number;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useChat(threadId: string): ChatState {
  const [kind, id] = threadId.split(':') as ['event' | 'section', string];
  const joined = useUserStore((s) => s.joinedDemoSections.includes(id));
  const query = useQuery({
    queryKey: ['chat', threadId, joined],
    queryFn: () => asPromise(() => (kind === 'event' ? getEventChat(id, currentTime()) : getSectionChat(id, currentTime(), joined))),
    refetchInterval: (q) => refreshEvery(q.state.data),
  });
  const profile = useUserStore((s) => s.profile);
  const mine = useUserStore((s) => s.messages);
  const blocked = useUserStore((s) => s.blocked);
  const hidden = useUserStore((s) => s.hiddenMessages);
  const reactions = useUserStore((s) => s.reactions);
  const data = query.data;
  const updatedAt = query.dataUpdatedAt;

  const messages = useMemo<ChatEntry[]>(() => {
    const now = updatedAt;
    const sportId = data?.sportId ?? null;
    const own: ChatEntry[] = [];
    for (const m of mine) {
      if (m.threadId !== threadId || m.deleted) continue;
      const echo = echoesFor(m, profile.username, now, sportId);
      own.push({ id: m.id, threadId, userId: 'me', username: profile.username, displayName: profile.displayName,
        avatarSeed: profile.avatarSeed, body: m.body, at: m.at, playId: null, isMine: true, reactions: echo.reactions,
        kind: 'fan', supports: null, replyTo: null, moment: null });
      own.push(...echo.replies);
    }
    const all = [...own, ...(data?.messages ?? [])]
      .filter((m) => !blocked.includes(m.userId) && !hidden.includes(m.id))
      .map((m) => {
        const my = reactions[m.id];
        if (!my) return m;
        return { ...m, reactions: { ...m.reactions, [my]: (m.reactions[my] ?? 0) + 1 } };
      });
    return all.sort((a, b) => b.at - a.at);
  }, [mine, data, blocked, hidden, reactions, profile, threadId, updatedAt]);

  const typing = useMemo(() => (data?.typing ?? []).filter((t) => !blocked.includes(t.userId)).map((t) => t.username), [data, blocked]);

  return {
    messages,
    typing,
    phase: data?.phase ?? (kind === 'section' ? 'section' : 'pre'),
    live: data?.live ?? false,
    watchers: data?.watchers ?? null,
    chatters: data?.chatters ?? (kind === 'section' ? 1 : 0),
    members: data?.members ?? (kind === 'section' ? 1 : null),
    hype: data?.hype ?? null,
    updatedAt,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => { query.refetch(); },
  };
}
