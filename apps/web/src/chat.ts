import { ChatThread } from './types';

export { chatIdFor } from '@goalpath/shared';

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
