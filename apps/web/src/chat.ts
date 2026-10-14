import { ChatThread } from './types';

/**
 * The document id for the conversation between two users. Both uids are sorted
 * and joined, so whichever side opens the chat resolves the same thread.
 */
export const chatIdFor = (uidA: string, uidB: string): string =>
  [uidA, uidB].sort().join('__');

/**
 * Whether a thread holds a message the given user has not seen: a last message
 * from the other side, newer than the last time this user opened the thread.
 */
export const threadHasUnread = (thread: ChatThread, uid: string): boolean => {
  const last = thread.lastMessage;
  if (!last || last.senderUid === uid) return false;
  const seenAt = thread.lastRead?.[uid] || '';
  return last.createdAt > seenAt;
};
