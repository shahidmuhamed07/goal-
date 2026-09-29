import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  setDoc,
} from 'firebase/firestore';
import { Send, X, MessageCircle } from 'lucide-react';
import { db } from '../firebase';
import { ChatMessage } from '../types';
import { chatIdFor } from '../chat';

interface ChatPanelProps {
  me: { uid: string; name: string };
  other: { uid: string; name: string; role?: string };
  onClose: () => void;
}

/** A short "9:41 AM" clock for a stored ISO timestamp. */
const formatTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

/** A day heading such as "Today", "Yesterday" or "Mon, Sep 22". */
const formatDayLabel = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

export const ChatPanel: React.FC<ChatPanelProps> = ({ me, other, onClose }) => {
  const chatId = useMemo(() => chatIdFor(me.uid, other.uid), [me.uid, other.uid]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // On phones the software keyboard shrinks the *visual* viewport but not the
  // layout viewport, so a full-height fixed panel keeps its size and the
  // keyboard shoves the header and messages off the top. Tracking the visual
  // viewport lets us size the panel to the space actually on screen — header at
  // the top, composer just above the keyboard — the way a chat app behaves.
  const [vv, setVv] = useState<{ height: number; top: number } | null>(null);
  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return undefined;
    const update = () =>
      setVv({ height: visualViewport.height, top: visualViewport.offsetTop });
    update();
    visualViewport.addEventListener('resize', update);
    visualViewport.addEventListener('scroll', update);
    return () => {
      visualViewport.removeEventListener('resize', update);
      visualViewport.removeEventListener('scroll', update);
    };
  }, []);

  // Marks the thread read for this user without clobbering the other side's
  // fields. Also creates the thread doc the first time it is opened.
  const markRead = () => {
    setDoc(
      doc(db, 'chats', chatId),
      {
        participantUids: [me.uid, other.uid].sort(),
        lastRead: { [me.uid]: new Date().toISOString() },
      },
      { merge: true }
    ).catch((err) => console.error('Chat markRead:', err));
  };

  useEffect(() => {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const unsub = onSnapshot(
      query(messagesRef, orderBy('createdAt')),
      (snap) => {
        setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage)));
        setLoading(false);
        markRead();
      },
      (err) => {
        console.error('Chat messages listener:', err);
        setError('Could not load this conversation.');
        setLoading(false);
      }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // Keep the newest message in view as the thread grows, on open, and when the
  // keyboard opens or closes (which changes the visible height).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, vv]);

  // Focus the composer when the panel opens.
  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, []);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    const now = new Date().toISOString();
    try {
      // Thread first: the message security rule reads the parent's member list,
      // so the thread document must exist before the first message is written.
      await setDoc(
        doc(db, 'chats', chatId),
        {
          participantUids: [me.uid, other.uid].sort(),
          updatedAt: now,
          lastMessage: { text, senderUid: me.uid, createdAt: now },
          lastRead: { [me.uid]: now },
        },
        { merge: true }
      );
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderUid: me.uid,
        senderName: me.name,
        text,
        createdAt: now,
      });
      setDraft('');
      const input = inputRef.current;
      if (input) input.style.height = 'auto';
    } catch (err) {
      console.error('Send message:', err);
      setError('Message could not be sent. Check your connection.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const autoGrow = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const initial = (other.name || 'P').charAt(0).toUpperCase();

  // A day separator is drawn whenever the calendar day changes down the list.
  let lastDay = '';

  return (
    <div
      className="fixed inset-x-0 z-[60] flex items-stretch sm:items-center justify-center sm:p-4 fade"
      style={vv ? { top: vv.top, height: vv.height } : { top: 0, bottom: 0 }}
    >
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 flex flex-col w-full sm:max-w-lg h-full sm:h-[80vh] sm:max-h-[680px] bg-slate-50 sm:rounded-3xl overflow-hidden shadow-2xl border border-slate-200 pop">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shrink-0 safe-top">
          <span className="w-9 h-9 rounded-full grid place-items-center text-sm font-black text-white bg-gradient-to-br from-emerald-500 to-teal-700 shrink-0">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-slate-900 truncate">{other.name}</div>
            {other.role && (
              <div className="text-[11px] font-semibold text-emerald-700">{other.role}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer shrink-0"
            title="Close conversation"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-1 slim-scroll"
        >
          {loading ? (
            <p className="text-center text-xs font-semibold text-slate-400 py-10">
              Loading conversation…
            </p>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-3">
              <span className="w-14 h-14 rounded-2xl grid place-items-center bg-emerald-50 text-emerald-600 border border-emerald-200">
                <MessageCircle className="w-7 h-7" />
              </span>
              <p className="text-sm font-bold text-slate-700">No messages yet</p>
              <p className="text-xs text-slate-500 max-w-[15rem]">
                Send the first message to start working together with {other.name}.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.senderUid === me.uid;
              const day = formatDayLabel(m.createdAt);
              const showDay = day !== lastDay;
              lastDay = day;
              return (
                <React.Fragment key={m.id}>
                  {showDay && (
                    <div className="flex justify-center py-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-200/70 px-2.5 py-0.5 rounded-full">
                        {day}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] px-3.5 py-2 rounded-2xl shadow-2xs ${
                        mine
                          ? 'bg-emerald-600 text-white rounded-br-md'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                        {m.text}
                      </p>
                      <div
                        className={`text-[10px] mt-1 text-right tabular-nums ${
                          mine ? 'text-emerald-100/90' : 'text-slate-400'
                        }`}
                      >
                        {formatTime(m.createdAt)}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Composer */}
        <div className="shrink-0 bg-white border-t border-slate-200 px-3 py-2.5 safe-bottom">
          {error && <p className="text-[11px] text-rose-600 mb-1.5 px-1">{error}</p>}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={autoGrow}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${other.name}…`}
              className="flex-1 resize-none text-sm bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 max-h-[120px]"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!draft.trim() || sending}
              className="w-10 h-10 shrink-0 grid place-items-center rounded-full bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              title="Send message"
            >
              <Send className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
