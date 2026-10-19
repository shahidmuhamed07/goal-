import { randomInt, randomUUID } from 'node:crypto';
import { Router, type Request, type RequestHandler, type Response } from 'express';
import {
  buildGoalAccessArrays,
  chatIdFor,
  requestIdFor,
  type AccessRequest,
  type ChatMessage,
  type ChatThread,
  type Collaborator,
  type Goal,
  type GoalAccessLevel,
  type UserProfile,
} from '@goalpath/shared';
import type { Identity, TokenVerifier } from './auth';
import { DuplicateError, type ContentStore, type Doc } from './store';
import {
  MAX_GOAL_BYTES,
  assignmentsBody,
  createGoalBody,
  goalAccessBody,
  messageBody,
  patchGoalBody,
  patchMeBody,
  publicProfileBody,
  requestAccessBody,
} from './userSchemas';

export interface UserRoutesOptions {
  /** Checks a login token. Without it every route answers 503 (nobody can be told apart). */
  verify?: TokenVerifier;
  now: () => Date;
}

/** Characters for an access code: no 0/O or 1/I, so a code read aloud is not misheard. */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');

/** Counts what each person does in a minute, so a tool cannot hammer one door. */
function createLimiter(now: () => Date) {
  const hits = new Map<string, { windowStart: number; count: number }>();
  return (bucket: string, max: number): RequestHandler =>
    (_req, res, next) => {
      const key = `${bucket}:${(res.locals.user as Identity).uid}`;
      const at = now().getTime();
      const entry = hits.get(key);
      if (!entry || at - entry.windowStart >= 60_000) {
        hits.set(key, { windowStart: at, count: 1 });
        next();
        return;
      }
      entry.count += 1;
      if (entry.count > max) {
        res.status(429).json({ error: 'too_many_requests' });
        return;
      }
      next();
    };
}

const asProfile = (d: Doc): UserProfile => d as unknown as UserProfile;
const asGoal = (d: Doc): Goal => d as unknown as Goal;
const asRequest = (d: Doc): AccessRequest => d as unknown as AccessRequest;
const asDoc = (v: unknown): Doc => v as Doc;

/** What other people may see of an account: never its invite code or its answers to the first-run questions. */
function publicView(profile: UserProfile): UserProfile {
  const { code: _code, onboarding: _onboarding, ...rest } = profile;
  return rest;
}

export function createUserRoutes(store: ContentStore, options: UserRoutesOptions) {
  const router = Router();
  const limit = createLimiter(options.now);
  const nowIso = () => options.now().toISOString();

  /** The person asking, from their login token. */
  const requireUser: RequestHandler = async (req, res, next) => {
    if (!options.verify) {
      res.status(503).json({ error: 'login_not_configured' });
      return;
    }
    const header = req.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ error: 'login_required' });
      return;
    }
    try {
      res.locals.user = await options.verify(token);
      next();
    } catch {
      res.status(401).json({ error: 'login_required' });
    }
  };
  // Only these doors need a login; anything else falls through to the server's own "not found".
  router.use(['/me', '/overview', '/clients', '/users', '/public-profiles', '/access-requests', '/collaborators', '/goals', '/chats'], requireUser);

  const me = (res: Response) => res.locals.user as Identity;
  const wrap =
    (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
    (req, res, next) => {
      fn(req, res).catch(next);
    };

  const getProfile = async (uid: string) => {
    const doc = await store.get('users', uid);
    return doc ? asProfile(doc) : null;
  };
  const saveProfile = (profile: UserProfile) => store.upsert('users', asDoc(profile));

  /**
   * Gives every goal of `ownerUid` the access lists its collaborators imply.
   * Every route that changes who may see what ends here, so the lists can never drift from the roster.
   */
  const syncGoalAccess = async (ownerUid: string, collaborators: Collaborator[], onlyGoalIds?: string[]) => {
    const goals = (await store.find('goals', { userId: ownerUid })).map(asGoal);
    for (const goal of goals) {
      if (onlyGoalIds && !onlyGoalIds.includes(goal.id)) continue;
      const { viewerUids, editorUids } = buildGoalAccessArrays(collaborators, goal.id);
      if ((goal.viewerUids ?? []).join(',') === viewerUids.join(',') && (goal.editorUids ?? []).join(',') === editorUids.join(',')) continue;
      await store.upsert('goals', asDoc({ ...goal, viewerUids, editorUids }));
    }
  };

  const ownGoalIds = async (ownerUid: string) => (await store.find('goals', { userId: ownerUid })).map((g) => g.id);

  /** Drops a professional from an account's roster and from every goal's access lists. */
  const detachProfessional = async (clientUid: string, proUid: string) => {
    const client = await getProfile(clientUid);
    if (!client) return;
    const collaborators = (client.collaborators ?? []).filter((c) => c.uid !== proUid);
    const collaboratorUids = (client.collaboratorUids ?? []).filter((u) => u !== proUid);
    await saveProfile({ ...client, collaborators, collaboratorUids });
    await syncGoalAccess(clientUid, collaborators);
    const request = await store.get('accessRequests', requestIdFor(proUid, clientUid));
    if (request) await store.upsert('accessRequests', asDoc({ ...request, status: 'removed' }));
  };

  /* ---- my account -------------------------------------------------------- */

  /**
   * Called right after sign-in: creates the account record on first use (with its
   * invite code) and keeps the name, email and photo in step with the login.
   */
  router.post(
    '/me/sync',
    limit('sync', 30),
    wrap(async (_req, res) => {
      const who = me(res);
      const existing = await getProfile(who.uid);
      const base = {
        id: who.uid,
        displayName: who.name || existing?.displayName || '',
        email: who.email || existing?.email || '',
        photoURL: who.picture || existing?.photoURL || '',
      };
      if (existing?.code) {
        const updated = { ...existing, ...base };
        await saveProfile(updated);
        res.json(updated);
        return;
      }
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const profile: UserProfile = {
          ...existing,
          ...base,
          code: makeCode(),
          collaborators: existing?.collaborators ?? [],
          collaboratorUids: existing?.collaboratorUids ?? [],
          createdAt: existing?.createdAt ?? nowIso(),
        };
        try {
          await saveProfile(profile);
          res.json(profile);
          return;
        } catch (e) {
          if (e instanceof DuplicateError) continue; // that code was taken: draw another
          throw e;
        }
      }
      res.status(503).json({ error: 'no_free_code' });
    }),
  );

  router.get(
    '/me',
    wrap(async (_req, res) => {
      const profile = await getProfile(me(res).uid);
      if (!profile) {
        res.status(404).json({ error: 'no_account' });
        return;
      }
      res.set('Cache-Control', 'no-store');
      res.json(profile);
    }),
  );

  router.patch(
    '/me',
    wrap(async (req, res) => {
      const changes = patchMeBody.parse(req.body);
      const profile = await getProfile(me(res).uid);
      if (!profile) {
        res.status(404).json({ error: 'no_account' });
        return;
      }
      const updated = { ...profile, ...changes } as UserProfile;
      await saveProfile(updated);
      res.json(updated);
    }),
  );

  /**
   * Everything the app shows, in one answer: my account, my clients, my requests,
   * my conversations, my goals and the goals shared with me. The app asks for this
   * every few seconds instead of keeping a live connection open.
   */
  router.get(
    '/overview',
    wrap(async (_req, res) => {
      const uid = me(res).uid;
      const profile = await getProfile(uid);
      if (!profile) {
        res.status(404).json({ error: 'no_account' });
        return;
      }
      const [clients, incoming, outgoing, threads, goals, sharedGoals] = await Promise.all([
        store.find('users', { collaboratorUids: uid }),
        store.find('accessRequests', { toUid: uid }),
        store.find('accessRequests', { fromUid: uid }),
        store.find('chats', { participantUids: uid }),
        store.find('goals', { userId: uid }),
        store.find('goals', { viewerUids: uid }),
      ]);
      // Not `no-store`: the browser may keep it, but must ask first. The answer carries a tag (ETag), so when
      // nothing changed the server replies "not modified" with no body, which keeps the every-10-seconds
      // refresh almost free. `Vary` keeps one person's answer from ever being matched to another's request.
      res.set({ 'Cache-Control': 'private, no-cache', Vary: 'Authorization' });
      res.json({ profile, clients: clients.map(asProfile).map(publicView), incoming, outgoing, threads, goals, sharedGoals });
    }),
  );

  /** Accounts that have connected me as their professional. */
  router.get(
    '/clients',
    wrap(async (_req, res) => {
      const clients = (await store.find('users', { collaboratorUids: me(res).uid })).map(asProfile);
      res.set('Cache-Control', 'no-store');
      res.json(clients.map(publicView));
    }),
  );

  /** One account's profile: my own, or a client's who connected me. Anyone else's looks like it does not exist. */
  router.get(
    '/users/:uid',
    wrap(async (req, res) => {
      const who = me(res).uid;
      const target = await getProfile(req.params.uid);
      if (!target) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      if (target.id === who) {
        res.json(target);
        return;
      }
      if (!(target.collaboratorUids ?? []).includes(who)) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.set('Cache-Control', 'no-store');
      res.json(publicView(target));
    }),
  );

  /* ---- a professional's public profile ----------------------------------- */

  router.get(
    '/public-profiles/:uid',
    wrap(async (req, res) => {
      const who = me(res).uid;
      const ownerUid = req.params.uid;
      let allowed = ownerUid === who;
      if (!allowed) {
        // A client may read the profile of a professional they approved.
        const request = await store.get('accessRequests', requestIdFor(ownerUid, who));
        allowed = !!request && asRequest(request).status === 'approved';
      }
      const profile = allowed ? await store.get('publicProfiles', ownerUid) : null;
      if (!profile) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.set('Cache-Control', 'no-store');
      res.json(profile);
    }),
  );

  router.put(
    '/me/public-profile',
    wrap(async (req, res) => {
      const body = publicProfileBody.parse(req.body);
      const uid = me(res).uid;
      const profile = asDoc({ ...body, id: uid, uid, updatedAt: nowIso() });
      await store.upsert('publicProfiles', profile);
      res.json(profile);
    }),
  );

  /* ---- connecting a client and a professional ---------------------------- */

  router.get(
    '/access-requests',
    wrap(async (_req, res) => {
      const uid = me(res).uid;
      const [incoming, outgoing] = await Promise.all([
        store.find('accessRequests', { toUid: uid }),
        store.find('accessRequests', { fromUid: uid }),
      ]);
      res.set('Cache-Control', 'no-store');
      res.json({ incoming, outgoing });
    }),
  );

  /** A professional asks to connect, using the client's code. */
  router.post(
    '/access-requests',
    limit('request', 10),
    wrap(async (req, res) => {
      const who = me(res);
      const { code, role } = requestAccessBody.parse(req.body);
      const target = (await store.find('users', { code }, { limit: 1 }))[0];
      if (!target) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      if (target.id === who.uid) {
        res.status(400).json({ error: 'own_account' });
        return;
      }
      const requestId = requestIdFor(who.uid, target.id);
      const existing = await store.get('accessRequests', requestId);
      if (existing) {
        const status = asRequest(existing).status;
        if (status === 'pending' || status === 'approved') {
          res.status(409).json({ error: status === 'pending' ? 'already_pending' : 'already_approved' });
          return;
        }
        // Denied or removed before: ask again.
        const again = asDoc({ ...existing, status: 'pending', role, createdAt: nowIso() });
        await store.upsert('accessRequests', again);
        res.json({ result: 'sent_again', request: again });
        return;
      }
      const request = asDoc({
        id: requestId,
        fromUid: who.uid,
        fromName: who.name || who.email || 'Professional',
        fromEmail: who.email,
        fromPhoto: who.picture || '',
        toUid: target.id,
        toCode: code,
        role,
        status: 'pending',
        createdAt: nowIso(),
      });
      await store.upsert('accessRequests', request);
      res.status(201).json({ result: 'sent', request });
    }),
  );

  /** The client says yes, and chooses which goals the professional gets. */
  router.post(
    '/access-requests/:id/approve',
    wrap(async (req, res) => {
      const uid = me(res).uid;
      const { goalAccess } = goalAccessBody.parse(req.body);
      const request = await store.get('accessRequests', req.params.id);
      const profile = await getProfile(uid);
      if (!request || !profile || asRequest(request).toUid !== uid) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      const r = asRequest(request);
      if (r.status !== 'pending') {
        res.status(409).json({ error: 'not_pending' });
        return;
      }
      const mine = new Set(await ownGoalIds(uid));
      const cleanAccess: Record<string, GoalAccessLevel> = {};
      for (const [goalId, level] of Object.entries(goalAccess)) if (mine.has(goalId)) cleanAccess[goalId] = level;

      const collaborators: Collaborator[] = [
        ...(profile.collaborators ?? []).filter((c) => c.uid !== r.fromUid),
        { uid: r.fromUid, role: r.role, addedAt: nowIso(), name: r.fromName || '', email: r.fromEmail || '', goalAccess: cleanAccess },
      ];
      const collaboratorUids = Array.from(new Set([...(profile.collaboratorUids ?? []), r.fromUid]));
      const updated = { ...profile, collaborators, collaboratorUids };
      await saveProfile(updated);
      await store.upsert('accessRequests', asDoc({ ...r, status: 'approved' }));
      await syncGoalAccess(uid, collaborators);
      res.json(updated);
    }),
  );

  router.post(
    '/access-requests/:id/deny',
    wrap(async (req, res) => {
      const request = await store.get('accessRequests', req.params.id);
      if (!request || asRequest(request).toUid !== me(res).uid) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      if (asRequest(request).status !== 'pending') {
        res.status(409).json({ error: 'not_pending' });
        return;
      }
      await store.upsert('accessRequests', asDoc({ ...request, status: 'denied' }));
      res.status(204).end();
    }),
  );

  /** Changes which goals one connected professional may see or edit. */
  router.put(
    '/collaborators/:uid/access',
    wrap(async (req, res) => {
      const uid = me(res).uid;
      const { goalAccess } = goalAccessBody.parse(req.body);
      const profile = await getProfile(uid);
      const roster = profile?.collaborators ?? [];
      if (!profile || !roster.some((c) => c.uid === req.params.uid)) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      const mine = new Set(await ownGoalIds(uid));
      const cleanAccess: Record<string, GoalAccessLevel> = {};
      for (const [goalId, level] of Object.entries(goalAccess)) if (mine.has(goalId)) cleanAccess[goalId] = level;
      const collaborators = roster.map((c) => {
        if (c.uid !== req.params.uid) return c;
        const { assignedGoalIds: _legacy, ...rest } = c;
        return { ...rest, goalAccess: cleanAccess };
      });
      const updated = { ...profile, collaborators };
      await saveProfile(updated);
      await syncGoalAccess(uid, collaborators);
      res.json(updated);
    }),
  );

  /** The client removes a connected professional. */
  router.delete(
    '/collaborators/:uid',
    wrap(async (req, res) => {
      const uid = me(res).uid;
      await detachProfessional(uid, req.params.uid);
      res.json(await getProfile(uid));
    }),
  );

  /** Chooses, for one goal, what each connected professional may do with it. */
  router.put(
    '/goals/:id/assignments',
    wrap(async (req, res) => {
      const uid = me(res).uid;
      const { assignments } = assignmentsBody.parse(req.body);
      const goal = await store.get('goals', req.params.id);
      const profile = await getProfile(uid);
      if (!goal || !profile || asGoal(goal).userId !== uid) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      const collaborators = (profile.collaborators ?? []).map((c) => {
        const wanted = assignments[c.uid];
        const goalAccess = { ...(c.goalAccess ?? {}) };
        if (wanted === 'view' || wanted === 'edit') goalAccess[goal.id] = wanted;
        else delete goalAccess[goal.id];
        const { assignedGoalIds: _legacy, ...rest } = c;
        return { ...rest, goalAccess };
      });
      const updated = { ...profile, collaborators };
      await saveProfile(updated);
      await syncGoalAccess(uid, collaborators, [goal.id]);
      res.json(updated);
    }),
  );

  /** A professional removes a client from their list. The client's side is cleaned up at once. */
  router.delete(
    '/clients/:clientId',
    wrap(async (req, res) => {
      await detachProfessional(req.params.clientId, me(res).uid);
      res.status(204).end();
    }),
  );

  /** A professional steps back to a plain account: every client is disconnected. */
  router.post(
    '/me/leave-professional',
    wrap(async (_req, res) => {
      const uid = me(res).uid;
      const clients = await store.find('users', { collaboratorUids: uid });
      for (const client of clients) await detachProfessional(client.id, uid);
      // Requests that never became a connection are closed too.
      for (const request of (await store.find('accessRequests', { fromUid: uid })).map(asRequest)) {
        if (request.status === 'pending') await store.upsert('accessRequests', asDoc({ ...request, status: 'removed' }));
      }
      const profile = await getProfile(uid);
      if (!profile) {
        res.status(404).json({ error: 'no_account' });
        return;
      }
      const updated = { ...profile, persona: 'client' as const, personaChosenAt: nowIso() };
      await saveProfile(updated);
      res.json({ profile: updated, disconnected: clients.length });
    }),
  );

  /* ---- goals ------------------------------------------------------------- */

  /** Goals in one workspace: my own, or the ones a client shared with me. */
  router.get(
    '/goals',
    wrap(async (req, res) => {
      const uid = me(res).uid;
      const workspace = typeof req.query.workspace === 'string' && req.query.workspace ? req.query.workspace : uid;
      const goals =
        workspace === uid
          ? await store.find('goals', { userId: uid })
          : (await store.find('goals', { viewerUids: uid })).filter((g) => asGoal(g).userId === workspace);
      res.set('Cache-Control', 'no-store');
      res.json(goals);
    }),
  );

  /** Every goal anyone has shared with me. */
  router.get(
    '/goals/shared',
    wrap(async (_req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await store.find('goals', { viewerUids: me(res).uid }));
    }),
  );

  const tooLarge = (goal: unknown) => Buffer.byteLength(JSON.stringify(goal)) > MAX_GOAL_BYTES;

  router.post(
    '/goals',
    limit('goal', 60),
    wrap(async (req, res) => {
      const uid = me(res).uid;
      const body = createGoalBody.parse(req.body);
      const { assignedProfessionalUids = [], ...content } = body;
      const profile = await getProfile(uid);
      const goalId = `goal-${randomUUID()}`;

      // Professionals picked while creating start with editing access.
      let collaborators = profile?.collaborators ?? [];
      const picked = collaborators.filter((c) => assignedProfessionalUids.includes(c.uid));
      if (picked.length > 0 && profile) {
        collaborators = collaborators.map((c) =>
          assignedProfessionalUids.includes(c.uid) ? { ...c, goalAccess: { ...(c.goalAccess ?? {}), [goalId]: 'edit' as const } } : c,
        );
        await saveProfile({ ...profile, collaborators });
      }
      const goal = asDoc({ ...content, id: goalId, userId: uid, ...buildGoalAccessArrays(collaborators, goalId) });
      if (tooLarge(goal)) {
        res.status(413).json({ error: 'goal_too_large' });
        return;
      }
      await store.upsert('goals', goal);
      res.status(201).json(goal);
    }),
  );

  router.patch(
    '/goals/:id',
    wrap(async (req, res) => {
      const uid = me(res).uid;
      const existing = await store.get('goals', req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      const goal = asGoal(existing);
      const isOwner = goal.userId === uid;
      const isEditor = (goal.editorUids ?? []).includes(uid);
      if (!isOwner && !isEditor) {
        // Someone who can see the goal is told it is read-only; anyone else should not even learn it exists.
        const canSee = (goal.viewerUids ?? []).includes(uid);
        res.status(canSee ? 403 : 404).json({ error: canSee ? 'read_only' : 'not_found' });
        return;
      }
      const changes = patchGoalBody.parse(req.body);
      // An editor changes the plan only: never the title, category, description or dates, and never the access lists.
      const planOnly = Object.keys(changes).every((k) => k === 'tasks' || k === 'subcategories' || k === 'milestones');
      if (!isOwner && !planOnly) {
        res.status(403).json({ error: 'owner_only' });
        return;
      }
      const updated = asDoc({ ...goal, ...changes });
      if (tooLarge(updated)) {
        res.status(413).json({ error: 'goal_too_large' });
        return;
      }
      await store.upsert('goals', updated);
      res.json(updated);
    }),
  );

  router.delete(
    '/goals/:id',
    wrap(async (req, res) => {
      const uid = me(res).uid;
      const existing = await store.get('goals', req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      const goal = asGoal(existing);
      if (goal.userId !== uid) {
        const canSee = (goal.viewerUids ?? []).includes(uid);
        res.status(canSee ? 403 : 404).json({ error: canSee ? 'owner_only' : 'not_found' });
        return;
      }
      await store.remove('goals', req.params.id);
      res.status(204).end();
    }),
  );

  /* ---- chat -------------------------------------------------------------- */

  const asThread = (d: Doc): ChatThread => d as unknown as ChatThread;

  /** The other person in a conversation, or null when `chatId` is not a conversation this person is in. */
  const otherInChat = (chatId: string, uid: string): string | null => {
    const parts = chatId.split('__');
    if (parts.length !== 2 || parts[0] === parts[1] || chatIdFor(parts[0], parts[1]) !== chatId) return null;
    return parts[0] === uid ? parts[1] : parts[1] === uid ? parts[0] : null;
  };

  /** Two people may write to each other only while one has connected the other. */
  const areConnected = async (a: string, b: string) => {
    const [pa, pb] = await Promise.all([getProfile(a), getProfile(b)]);
    return (pa?.collaboratorUids ?? []).includes(b) || (pb?.collaboratorUids ?? []).includes(a);
  };

  router.get(
    '/chats',
    wrap(async (_req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await store.find('chats', { participantUids: me(res).uid }));
    }),
  );

  router.get(
    '/chats/:chatId/messages',
    wrap(async (req, res) => {
      if (!otherInChat(req.params.chatId, me(res).uid)) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      const messages = await store.find('messages', { chatId: req.params.chatId }, { sort: 'createdAt' });
      res.set('Cache-Control', 'no-store');
      res.json(messages.map(({ chatId: _chat, ...message }) => message));
    }),
  );

  router.post(
    '/chats/:chatId/messages',
    limit('message', 60),
    wrap(async (req, res) => {
      const who = me(res);
      const other = otherInChat(req.params.chatId, who.uid);
      if (!other) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      const { text } = messageBody.parse(req.body);
      if (!(await areConnected(who.uid, other))) {
        res.status(403).json({ error: 'not_connected' });
        return;
      }
      const at = nowIso();
      const message: ChatMessage = { id: `msg-${randomUUID()}`, senderUid: who.uid, senderName: who.name || who.email, text, createdAt: at };
      await store.upsert('messages', asDoc({ ...message, chatId: req.params.chatId }));

      const existing = await store.get('chats', req.params.chatId);
      const thread = existing ? asThread(existing) : undefined;
      await store.upsert(
        'chats',
        asDoc({
          ...thread,
          id: req.params.chatId,
          participantUids: [who.uid, other].sort(),
          updatedAt: at,
          lastMessage: { text, senderUid: who.uid, createdAt: at },
          lastRead: { ...(thread?.lastRead ?? {}), [who.uid]: at },
        }),
      );
      res.status(201).json(message);
    }),
  );

  /** Marks a conversation as read by me. */
  router.post(
    '/chats/:chatId/read',
    wrap(async (req, res) => {
      const who = me(res).uid;
      if (!otherInChat(req.params.chatId, who)) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      const existing = await store.get('chats', req.params.chatId);
      if (existing) {
        const thread = asThread(existing);
        await store.upsert('chats', asDoc({ ...thread, lastRead: { ...(thread.lastRead ?? {}), [who]: nowIso() } }));
      }
      res.status(204).end();
    }),
  );

  return router;
}
