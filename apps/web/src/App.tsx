/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import type { ElementType } from 'react';
import {
  User,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  runTransaction,
} from 'firebase/firestore';

import {
  Plus,
  Target,
  Edit2,
  Trash2,
  Check,
  CheckCircle2,
  ShieldCheck,
  LogOut,
  Search,
  Settings,
  Flag,
  X,
  ArrowRight,
  Sparkles,
  Briefcase,
  Copy,
  ListChecks,
  CalendarCheck,
  UsersRound,
} from 'lucide-react';

import { auth, db, googleProvider } from './firebase';
import {
  Goal,
  Milestone,
  Subcategory,
  TaskItem,
  UserProfile,
  AccessRequest,
  ProfessionalRole,
  Collaborator,
  GoalAccessLevel,
  AccountPersona,
  ChatThread,
} from './types';
import {
  getTodayDateString,
  getCurrentMonthKey,
  formatMonthKey,
  formatFullMonth,
  generateMonthRange,
  generateInviteCode,
  requestDocId,
  formatJoinedDate,
  PROFESSIONAL_ROLES,
  getMonthDays,
  formatDisplayDate,
  addMonthsToKey,
  buildGoalAccessArrays,
  getGoalAccessLevel,
  isGoalSharedWith,
  computeStreak,
} from './utils';

import {
  MAX_GOAL_CONTENT_BYTES,
  addTaskForward,
  applySeriesDays,
  createSeries,
  describeDays,
  describePattern,
  estimateBytes,
  goalEndDate,
  occurrencesFrom,
  removeSubcategories,
  updateFrom,
  type RepeatPattern,
} from './recurrence';

import { LoginScreen } from './components/LoginScreen';
import { AppSelect } from './components/AppSelect';
import { Orb } from './components/Orb';
import { CmsBanners } from './cms/CmsBanners';
import { useLiveBanners } from './cms/useLiveBanners';
import { ProgressBar, GoalPathLogo, GoalPathLoader, GlassIconButton, GlassBadge, StreakBadge } from './components/UIElements';
import { DailyTaskSection } from './components/DailyTaskSection';
import { SubcategoryBlock } from './components/SubcategoryBlock';
import { GoalCard } from './components/GoalCard';
import { OnboardingAnswers, StarterPlan, materializePlan } from './starterPlan';
import { MonthlyMilestoneSection } from './components/MonthlyMilestoneSection';
import { CollaboratorsPanel } from './components/CollaboratorsPanel';
import { CreateGoalModal } from './components/CreateGoalModal';
import { GoalAssignmentModal } from './components/GoalAssignmentModal';
import { GiveUpInterventionModal } from './components/GiveUpInterventionModal';

import { ProfessionalProfilePanel } from './components/ProfessionalProfilePanel';
import { AccountProfilePanel } from './components/AccountProfilePanel';
import { Onboarding } from './components/Onboarding';
import { GuidedGoal } from './components/GuidedGoal';
import { nicheForCategory, type NicheKey } from './guidedGoal';
import { ChatPanel } from './components/ChatPanel';
import { threadHasUnread } from './chat';

/**
 * Slides a pill behind the active item of a segmented control.
 *
 * The track is measured from the live DOM rather than from fixed widths, so it
 * lands exactly on the active tab whatever the label, badge or viewport is.
 */
function useSegmentedTrack(activeKey: string) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [track, setTrack] = useState({ x: 0, width: 0, ready: false });

  const ref = useCallback((element: HTMLElement | null) => setNode(element), []);

  const measure = useCallback(() => {
    if (!node) return;
    const active = node.querySelector<HTMLElement>('[data-active="true"]');
    if (!active) return;
    const next = { x: active.offsetLeft, width: active.offsetWidth, ready: true };
    setTrack((prev) =>
      prev.x === next.x && prev.width === next.width && prev.ready ? prev : next
    );
  }, [node]);

  useLayoutEffect(() => {
    measure();
    if (!node) return;

    // Labels, badges and fonts all move the target, so watch the bar itself.
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener('resize', measure);
    if (document.fonts?.ready) void document.fonts.ready.then(measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [node, measure, activeKey]);

  return { ref, track };
}

/** Maps a Firestore goal document onto the shape the interface uses. */
const mapGoalDoc = (id: string, data: Record<string, unknown>): Goal => ({
  id,
  userId: (data.userId as string) || '',
  title: (data.title as string) || '',
  category: (data.category as string) || 'General',
  description: (data.description as string) || '',
  createdAt: (data.createdAt as string) || '',
  targetDate: (data.targetDate as string) || '',
  milestones: (data.milestones as Goal['milestones']) || [],
  subcategories: (data.subcategories as Goal['subcategories']) || [],
  tasks: (data.tasks as Goal['tasks']) || [],
  viewerUids: Array.isArray(data.viewerUids) ? (data.viewerUids as string[]) : undefined,
  editorUids: Array.isArray(data.editorUids) ? (data.editorUids as string[]) : undefined,
});

async function ensureUserProfile(firebaseUser: User) {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const existing = await getDoc(userRef);
  if (existing.exists() && existing.data().code) {
    await updateDoc(userRef, {
      displayName: firebaseUser.displayName || existing.data().displayName || '',
      email: firebaseUser.email || existing.data().email || '',
      photoURL: firebaseUser.photoURL || existing.data().photoURL || '',
    });
    return;
  }

  for (let i = 0; i < 10; i += 1) {
    const code = generateInviteCode();
    const codeRef = doc(db, 'codes', code);
    try {
      await runTransaction(db, async (transaction) => {
        const codeSnap = await transaction.get(codeRef);
        const userSnap = await transaction.get(userRef);
        if (userSnap.exists() && userSnap.data().code) return;
        if (codeSnap.exists()) throw new Error('CODE_TAKEN');
        transaction.set(codeRef, { uid: firebaseUser.uid });
        transaction.set(
          userRef,
          {
            displayName: firebaseUser.displayName || '',
            email: firebaseUser.email || '',
            photoURL: firebaseUser.photoURL || '',
            code,
            collaborators: userSnap.exists() ? userSnap.data().collaborators || [] : [],
            collaboratorUids: userSnap.exists() ? userSnap.data().collaboratorUids || [] : [],
            createdAt: new Date().toISOString(),
          },
          { merge: true }
        );
      });
      return;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('CODE_TAKEN')) continue;
      throw err;
    }
  }
  throw new Error('Could not generate a unique access code.');
}

export default function App() {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  // Something the login screen should say that is not a failure, such as "taking
  // you to Google's page instead".
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const googleSignInBusy = useRef(false);

  // Data State
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [giveUpTargetGoal, setGiveUpTargetGoal] = useState<Goal | null>(null);

  // UI View State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'today' | 'detail' | 'connect' | 'professional'>('dashboard');
  // Which side the next view slides in from: 1 = from the right, -1 = from the left.
  const [tabDirection, setTabDirection] = useState<1 | -1>(1);
  const [savingPersona, setSavingPersona] = useState(false);
  const [personaPromptDismissed, setPersonaPromptDismissed] = useState(false);
  // True while the first-run questions are on screen (they are also opened by hand).
  const [personaPickerOpen, setPersonaPickerOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // The optional "Help me plan" questions, opened from inside the create-goal form.
  const [guidedOpen, setGuidedOpen] = useState(false);
  const [guidedNiche, setGuidedNiche] = useState<NicheKey | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [dailyMasterDate, setDailyMasterDate] = useState<string>(getTodayDateString());
  const [selectedGoalMonth, setSelectedGoalMonth] = useState<string>(getCurrentMonthKey());
  // A day picked on a goal card: the goal opens on it instead of on today.
  const [selectedGoalDate, setSelectedGoalDate] = useState<string | null>(null);
  const [managingAssignedGoal, setManagingAssignedGoal] = useState<Goal | null>(null);

  // Today's Focus: which blocks the person has collapsed, and the quick-add form
  const [todayCollapsed, setTodayCollapsed] = useState<Record<string, boolean>>({});
  const toggleTodayBlock = (id: string) =>
    setTodayCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  const [todayAddingSubGoalId, setTodayAddingSubGoalId] = useState<string | null>(null);
  const [todayNewSubName, setTodayNewSubName] = useState('');

  // Goal Details Editing State
  const [isEditingGoalHeader, setIsEditingGoalHeader] = useState(false);
  const [editGoalTitle, setEditGoalTitle] = useState('');
  const [editGoalCategory, setEditGoalCategory] = useState('');
  const [editGoalDesc, setEditGoalDesc] = useState('');

  // Collaborator / workspace state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<AccessRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<AccessRequest[]>([]);
  const [clientList, setClientList] = useState<UserProfile[]>([]);
  const [clientsReady, setClientsReady] = useState(false);
  /**
   * Clients this professional has removed from their own list. Kept on their
   * own profile so it follows them between devices. Only the client can fully
   * revoke access, so the shared request is marked "removed" and the client's
   * account drops the professional the next time it signs in.
   */
  const [withdrawnClientIds, setWithdrawnClientIds] = useState<string[]>([]);
  const [workspaceUid, setWorkspaceUid] = useState<string | null>(null);
  const [connectNotice, setConnectNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [incomingError, setIncomingError] = useState<string | null>(null);

  // Client ↔ professional chat
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([]);
  const [chatTarget, setChatTarget] = useState<{ uid: string; name: string; role?: string } | null>(null);

  /**
   * The clients actually shown in the interface: everyone connected except the
   * ones this professional has removed.
   */
  const visibleClients = useMemo(
    () => clientList.filter((c) => !withdrawnClientIds.includes(c.id || '')),
    [clientList, withdrawnClientIds]
  );

  // Listen for Firebase Auth State Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setAuthLoading(false);
      },
      (err) => {
        console.error('Auth state error:', err);
        setAuthError(err.message);
        setAuthLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Coming back from a redirect sign-in is a fresh page load. Firebase finishes
  // the sign-in itself, but it swallows a failure, so ask for the outcome and
  // show it rather than landing on a login page that looks like nothing happened.
  useEffect(() => {
    getRedirectResult(auth).catch((err: unknown) => {
      const redirectErr = err as { message?: string };
      console.error('Google redirect result error:', err);
      setAuthError(
        redirectErr.message || 'Google sign-in could not be completed. Please try again.'
      );
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setWorkspaceUid(null);
      setProfile(null);
      return;
    }
    setWorkspaceUid((prev) => prev || user.uid);
    ensureUserProfile(user).catch((err) => {
      console.error('ensureUserProfile:', err);
      setErrorMessage(
        err.message || 'Could not set up your access code. Check Firestore rules for users/codes.'
      );
    });
  }, [user]);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return undefined;
    }
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setProfile({ id: snap.id, ...data } as UserProfile);
          setWithdrawnClientIds(Array.isArray(data.withdrawnClients) ? data.withdrawnClients : []);
        }
      },
      (err) => {
        console.error('Profile listener:', err);
        setErrorMessage('Unable to load your profile. Allow read/write on the users collection.');
      }
    );
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setIncomingError(null);
      return undefined;
    }
    const incomingQ = query(collection(db, 'accessRequests'), where('toUid', '==', user.uid));
    const outgoingQ = query(collection(db, 'accessRequests'), where('fromUid', '==', user.uid));

    const unsubIn = onSnapshot(
      incomingQ,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AccessRequest));
        setIncomingError(null);
        setIncomingRequests(rows);
      },
      (err) => {
        console.error('[accessRequests incoming ERROR]', err.code, err.message, err);
        setIncomingError(err.message || String(err));
      }
    );
    const unsubOut = onSnapshot(
      outgoingQ,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AccessRequest));
        setOutgoingRequests(rows);
      },
      (err) => console.error('[accessRequests outgoing ERROR]', err.code, err.message, err)
    );
    return () => {
      unsubIn();
      unsubOut();
    };
  }, [user]);

  // All conversations this user is part of, for the message threads and their
  // unread markers. Kept account-wide (not workspace-scoped) so a new message
  // shows up wherever the user is.
  useEffect(() => {
    if (!user) {
      setChatThreads([]);
      return undefined;
    }
    const threadsQ = query(
      collection(db, 'chats'),
      where('participantUids', 'array-contains', user.uid)
    );
    const unsub = onSnapshot(
      threadsQ,
      (snap) => setChatThreads(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatThread))),
      (err) => console.error('Chat threads listener:', err)
    );
    return () => unsub();
  }, [user]);

  // Uids this user has an unread message from, and the total, for the badges.
  const unreadChatUids = useMemo(() => {
    const set = new Set<string>();
    if (!user) return set;
    chatThreads.forEach((thread) => {
      if (threadHasUnread(thread, user.uid)) {
        (thread.participantUids || []).forEach((uid) => {
          if (uid !== user.uid) set.add(uid);
        });
      }
    });
    return set;
  }, [chatThreads, user]);

  // Realtime client list & active client profile listener
  const [activeClientProfile, setActiveClientProfile] = useState<UserProfile | null>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  /**
   * A professional who removes a client marks the shared request "removed".
   * Access itself lives on the client's account, so the client is the one who
   * can actually clear it. This runs that cleanup the next time they sign in.
   */
  const clearedWithdrawnPros = useRef<string[]>([]);
  useEffect(() => {
    if (!user || !profile) return;
    const stillListed = (profile.collaborators || []).map((c) => c.uid);
    const pending = incomingRequests.filter(
      (r) => r.status === 'removed' && stillListed.includes(r.fromUid)
    );
    const next = pending.find((r) => !clearedWithdrawnPros.current.includes(r.fromUid));
    if (!next) return;
    clearedWithdrawnPros.current.push(next.fromUid);
    handleRemoveCollaborator(next.fromUid);
  }, [user, profile, incomingRequests]);

  useEffect(() => {
    if (!user) {
      setClientList([]);
      setClientsReady(false);
      return undefined;
    }
    const clientsQ = query(
      collection(db, 'users'),
      where('collaboratorUids', 'array-contains', user.uid)
    );
    const unsub = onSnapshot(
      clientsQ,
      (snap) => {
        setClientList(snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserProfile)));
        setClientsReady(true);
      },
      (err) => {
        console.error('Client list:', err);
        setClientsReady(true);
      }
    );
    return () => unsub();
  }, [user]);

  // Realtime listener for active client workspace if switching to a client's account
  useEffect(() => {
    if (!user || !workspaceUid || workspaceUid === user.uid) {
      setActiveClientProfile(null);
      return undefined;
    }
    const unsub = onSnapshot(
      doc(db, 'users', workspaceUid),
      (snap) => {
        if (snap.exists()) {
          setActiveClientProfile({ id: snap.id, ...snap.data() } as UserProfile);
        }
      },
      (err) => console.error('Active client profile listener:', err)
    );
    return () => unsub();
  }, [user, workspaceUid]);

  useEffect(() => {
    if (!user || !workspaceUid || workspaceUid === user.uid) return;
    if (!clientsReady) return;
    if (!visibleClients.some((c) => c.id === workspaceUid) && !activeClientProfile) {
      setWorkspaceUid(user.uid);
      setActiveTab('dashboard');
      setSelectedGoalId(null);
    }
  }, [user, workspaceUid, visibleClients, activeClientProfile, clientsReady]);

  // Realtime Firestore: goals for active workspace
  useEffect(() => {
    if (!user || !workspaceUid) {
      setGoals([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    setErrorMessage(null);

    const goalsRef = collection(db, 'goals');
    // The owner loads their own goals. A professional loads every goal shared
    // with them, because that is the only shape the security rules can prove.
    // Goals belonging to other clients are filtered out below, so one client's
    // workspace never shows another client's goals.
    const viewingClient = workspaceUid !== user.uid;
    const q = viewingClient
      ? query(goalsRef, where('viewerUids', 'array-contains', user.uid))
      : query(goalsRef, where('userId', '==', workspaceUid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedGoals: Goal[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (viewingClient && data.userId !== workspaceUid) return;
          fetchedGoals.push(mapGoalDoc(docSnap.id, data));
        });

        // Sort newest first
        fetchedGoals.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

        setGoals(fetchedGoals);
        setDataLoading(false);
      },
      (error) => {
        console.error('Firestore onSnapshot error:', error);
        setErrorMessage('Unable to load goals from cloud storage. Please check connection.');
        setDataLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, workspaceUid]);


  /**
   * Every goal shared with this professional, across all of their clients.
   *
   * The workspace listener above only ever loads one workspace at a time, so on
   * the dashboard it returns the professional's own goals and the per-client
   * "Assigned Session(s)" counts came out as zero. This keeps the full picture.
   */
  const [sharedGoals, setSharedGoals] = useState<Goal[]>([]);
  const isProfessional = clientList.length > 0 || profile?.persona === 'professional';
  useEffect(() => {
    if (!user || !isProfessional) {
      setSharedGoals([]);
      return undefined;
    }
    const q = query(collection(db, 'goals'), where('viewerUids', 'array-contains', user.uid));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const rows: Goal[] = [];
        snapshot.forEach((docSnap) => rows.push(mapGoalDoc(docSnap.id, docSnap.data())));
        setSharedGoals(rows);
      },
      (err) => console.error('Shared goals listener:', err)
    );
    return () => unsub();
  }, [user, isProfessional]);

  const isOwner = !!user && workspaceUid === user.uid;

  // A brand-new account (no persona, no goals) starts with the guided questions.
  const needsOnboarding =
    !!user &&
    !!profile &&
    !dataLoading &&
    isOwner &&
    !profile.persona &&
    !profile.onboardedAt &&
    goals.length === 0 &&
    !personaPromptDismissed;
  useEffect(() => {
    if (needsOnboarding) setPersonaPickerOpen(true);
  }, [needsOnboarding]);

  // Banners the admin has published for this kind of person. Empty when the API is unreachable.
  const liveBanners = useLiveBanners(user ? (profile?.persona === 'professional' ? 'professional' : 'owner') : undefined);
  const workspaceProfile = isOwner
    ? profile
    : activeClientProfile || clientList.find((c) => c.id === workspaceUid) || null;
  const currentCollaborator = isOwner
    ? null
    : (workspaceProfile?.collaborators || []).find((c) => c.uid === user?.uid) || null;
  const approvedOutgoingReq = outgoingRequests.find((r) => r.toUid === workspaceUid && r.status === 'approved');
  const professionalRole = currentCollaborator?.role || approvedOutgoingReq?.role || null;
  const pendingIncoming = incomingRequests.filter((r) => r.status === 'pending');

  // --------------------------------------------------------------- swipe nav
  /** The tabs a swipe moves between, in the order they appear in the bar. */
  const swipeTabs = useMemo(() => {
    const tabs: Array<'dashboard' | 'today' | 'connect' | 'professional'> = [
      'dashboard',
      'today',
      'connect',
    ];
    if (isOwner) tabs.push('professional');
    return tabs;
  }, [isOwner]);

  const contentRef = useRef<HTMLElement | null>(null);
  const swipe = useRef<{
    x: number;
    y: number;
    dx: number;
    axis: 'none' | 'x' | 'y';
    active: boolean;
    locked: boolean;
  }>({ x: 0, y: 0, dx: 0, axis: 'none', active: false, locked: false });

  /** The tab a swipe of `step` places away lands on, or null when there is none. */
  const swipeTarget = (step: number) => {
    if (activeTab === 'detail') return step === -1 ? 'dashboard' : null;
    const index = swipeTabs.indexOf(activeTab as (typeof swipeTabs)[number]);
    if (index === -1) return null;
    const next = index + step;
    return next >= 0 && next < swipeTabs.length ? swipeTabs[next] : null;
  };

  const paintContent = (dx: number, opacity: number, transition: string) => {
    const element = contentRef.current;
    if (!element) return;
    element.style.transition = transition;
    element.style.transform = `translate3d(${dx}px, 0, 0)`;
    element.style.opacity = String(opacity);
  };

  const settleContent = () => {
    paintContent(0, 1, 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease-out');
    window.setTimeout(() => {
      const element = contentRef.current;
      if (!element) return;
      element.style.transition = '';
      element.style.transform = '';
      element.style.opacity = '';
      element.style.willChange = '';
      swipe.current.locked = false;
    }, 300);
  };

  /** Slides the current view out, swaps the tab, then lets the new one glide in. */
  const commitSwipe = (step: number) => {
    const target = swipeTarget(step);
    if (!target || swipe.current.locked) return;
    swipe.current.locked = true;
    const element = contentRef.current;
    if (element) element.style.willChange = 'transform, opacity';

    paintContent(
      step === 1 ? -58 : 58,
      0.22,
      'transform 140ms cubic-bezier(0.4, 0, 1, 1), opacity 140ms ease-in'
    );
    window.setTimeout(() => {
      setTabDirection(step === 1 ? 1 : -1);
      setSelectedGoalId(null);
      setActiveTab(target);
      window.scrollTo({ top: 0, behavior: 'auto' });
      // The incoming panel animates itself, so release the wrapper first.
      paintContent(0, 1, 'none');
      window.requestAnimationFrame(() => settleContent());
    }, 150);
  };

  useEffect(() => {
    const handleStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || swipe.current.locked) return;
      const target = event.target as HTMLElement | null;
      if (!target || !contentRef.current?.contains(target)) return;
      if (target.closest('input, textarea, select, [data-no-swipe]')) return;
      // Rows that scroll sideways keep that gesture for themselves.
      let node: HTMLElement | null = target;
      for (let depth = 0; node && depth < 6; depth += 1) {
        const overflowX = window.getComputedStyle(node).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') return;
        node = node.parentElement;
      }
      const touch = event.touches[0];
      swipe.current = {
        x: touch.clientX,
        y: touch.clientY,
        dx: 0,
        axis: 'none',
        active: true,
        locked: false,
      };
    };

    const handleMove = (event: TouchEvent) => {
      const state = swipe.current;
      if (!state.active || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dx = touch.clientX - state.x;
      const dy = touch.clientY - state.y;
      if (state.axis === 'none') {
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
        state.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        const element = contentRef.current;
        if (state.axis === 'x' && element) element.style.willChange = 'transform, opacity';
      }
      if (state.axis !== 'x') return;
      event.preventDefault();
      state.dx = dx;
      const step = dx < 0 ? 1 : -1;
      // Past the first or last tab the view barely moves, so the end is felt.
      const offset = swipeTarget(step) ? dx : dx * 0.3;
      paintContent(offset, 1 - Math.min(Math.abs(offset) / 900, 0.18), 'none');
    };

    const handleEnd = () => {
      const state = swipe.current;
      if (!state.active) return;
      state.active = false;
      if (state.axis !== 'x') return;
      const dx = state.dx;
      state.axis = 'none';
      const step = dx < 0 ? 1 : -1;
      const threshold = Math.min(90, window.innerWidth * 0.22);
      if (Math.abs(dx) > threshold && swipeTarget(step)) {
        commitSwipe(step);
        return;
      }
      settleContent();
    };

    document.addEventListener('touchstart', handleStart, { passive: true });
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);
    return () => {
      document.removeEventListener('touchstart', handleStart);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
    };
  }, [activeTab, swipeTabs]);

  /**
   * What the signed-in user may do with one goal. Access lives on the goal
   * document itself, which is what the Firestore rules check, so the interface
   * and the database always agree.
   *   'edit' - owner or assigned editor
   *   'view' - assigned read-only professional
   *   null   - not shared with this user
   */
  const goalAccessLevel = (goalId: string): GoalAccessLevel | null => {
    if (isOwner) return 'edit';
    const goal = goals.find((g) => g.id === goalId);
    if (!goal || !user) return null;
    if ((goal.editorUids || []).includes(user.uid)) return 'edit';
    if ((goal.viewerUids || []).includes(user.uid)) return 'view';
    return null;
  };

  const canViewGoal = (goalId: string) => goalAccessLevel(goalId) !== null;
  const canEditGoal = (goalId: string) => goalAccessLevel(goalId) === 'edit';

  // Goals created before per-goal permissions existed carry no access lists yet.
  // The owner's browser fills them in once, so professionals can be granted read
  // or edit access from then on.
  useEffect(() => {
    if (!isOwner || dataLoading) return;
    const stale = goals.filter(
      (g) => !Array.isArray(g.viewerUids) || !Array.isArray(g.editorUids)
    );
    if (stale.length === 0) return;

    (async () => {
      for (const goal of stale) {
        const { viewerUids, editorUids } = buildGoalAccessArrays(
          profile?.collaborators,
          goal.id
        );
        try {
          await updateDoc(doc(db, 'goals', goal.id), { viewerUids, editorUids });
        } catch (err) {
          console.error('Goal access backfill failed:', err);
        }
      }
    })();
  }, [isOwner, dataLoading, goals, profile?.collaborators]);

  const canEditSubcategoryTasks = (goalId: string, sub?: Subcategory) => {
    if (isOwner) return true;
    if (!canEditGoal(goalId)) return false;

    const currentUserRole = professionalRole || null;
    const subcategoryRole = sub?.editorRole || null;

    // If no role tag is assigned to the subcategory ("Client & Pros" / null / undefined / ""), any assigned pro can edit
    if (!subcategoryRole || subcategoryRole.trim() === '') {
      return true;
    }

    if (!currentUserRole) return false;

    return currentUserRole.trim().toLowerCase() === subcategoryRole.trim().toLowerCase();
  };

  const canEditTaskRecord = (goalId: string, task?: TaskItem) => {
    if (isOwner) return true;
    if (!canEditGoal(goalId)) return false;
    if (!task) return true;
    if (!task.subcategoryId) return true;
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return false;
    const sub = (goal.subcategories || []).find((s) => s.id === task.subcategoryId);
    return canEditSubcategoryTasks(goalId, sub);
  };

  /** Opens a goal, on today or on a day chosen from its card's week strip. */
  const openGoal = (goalId: string, date?: string) => {
    setSelectedGoalId(goalId);
    setSelectedGoalMonth(date ? date.slice(0, 7) : getCurrentMonthKey());
    setSelectedGoalDate(date || null);
    setActiveTab('detail');
  };

  // The chosen day only matters while a goal is being opened.
  useEffect(() => {
    if (activeTab !== 'detail') setSelectedGoalDate(null);
  }, [activeTab]);

  // Computed Current Goal
  const currentGoal = useMemo(() => {
    return goals.find((g) => g.id === selectedGoalId) || null;
  }, [goals, selectedGoalId]);

  // Global Stats
  const todayDate = getTodayDateString();
  const curMonthKey = getCurrentMonthKey();
  const masterMonthDays = useMemo(() => getMonthDays(curMonthKey), [curMonthKey]);

  const allTodayTasks = useMemo(() => {
    return goals.flatMap((g) =>
      (g.tasks || [])
        .filter((t) => t.date === todayDate)
        .map((t) => ({
          ...t,
          goalTitle: g.title,
          goalId: g.id,
          subcategoryName:
            (g.subcategories || []).find((s) => s.id === t.subcategoryId)?.name || '',
          editorRole:
            (g.subcategories || []).find((s) => s.id === t.subcategoryId)?.editorRole || null,
        }))
    );
  }, [goals, todayDate]);

  // Daily-completion streak for whichever workspace is open (the owner's own
  // goals, or the client's while a professional is helping them).
  const streakStats = useMemo(() => computeStreak(goals, todayDate), [goals, todayDate]);

  // The tabs reachable from the phone tab bar, in swipe order.
  type NavTab = {
    key: 'dashboard' | 'today' | 'connect' | 'professional';
    /** Short label for the phone bar. */
    label: string;
    /** Full label for the wide view switcher. */
    longLabel: string;
    Icon: ElementType;
    badge: number;
    /** Shown as a quiet count next to the label, when it means something. */
    count?: number;
  };

  const openTaskCount = allTodayTasks.filter((t) => !t.completed).length;

  const navTabs = useMemo<NavTab[]>(() => {
    const tabs: NavTab[] = [
      { key: 'dashboard', label: 'Goals', longLabel: 'All Goals', Icon: ListChecks, badge: 0, count: goals.length },
      { key: 'today', label: 'Today', longLabel: "Today's Focus", Icon: CalendarCheck, badge: openTaskCount },
      { key: 'connect', label: 'Connect', longLabel: 'Collaborate', Icon: UsersRound, badge: pendingIncoming.length + unreadChatUids.size },
    ];
    if (isOwner) {
      tabs.push({
        key: 'professional',
        label: 'Profile',
        longLabel: profile?.persona === 'professional' ? 'Professional' : 'Profile',
        Icon: Briefcase,
        badge: 0,
      });
    }
    return tabs;
  }, [isOwner, profile?.persona, openTaskCount, pendingIncoming.length, unreadChatUids.size, goals.length]);

  const isTabActive = (key: NavTab['key']) =>
    activeTab === key || (key === 'dashboard' && activeTab === 'detail');

  /**
   * Every tab change funnels through here: the bar, the phone bar and the
   * dashboard stat cards. Doing it in one place keeps the slide direction and
   * the scroll position in step, and makes a single gesture worth one tab.
   */
  const selectTab = (key: NavTab['key']) => {
    const from = activeTab === 'detail' ? 'dashboard' : activeTab;
    const fromIndex = navTabs.findIndex((tab) => tab.key === from);
    const toIndex = navTabs.findIndex((tab) => tab.key === key);
    if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
      setTabDirection(toIndex > fromIndex ? 1 : -1);
    }
    setSelectedGoalId(null);
    setActiveTab(key);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  // ------------------------------------------------- back-button nav
  /**
   * Browser / phone back button should walk inside the app first:
   *   detail -> Goals, Today/Connect/Profile -> Goals,
   *   Goals (1st back) -> "press back again" toast, Goals (2nd back) -> leave.
   * Modals and menus close first. One history trap keeps the first back
   * interceptable on laptop and phone instead of exiting / getting stuck.
   */
  const [exitPromptVisible, setExitPromptVisible] = useState(false);
  const lastBackPressRef = useRef(0);
  const exitPromptTimerRef = useRef<number | null>(null);
  const navStateRef = useRef({
    activeTab,
    selectedGoalId,
    isModalOpen,
    managingAssignedGoal,
    giveUpTargetGoal,
    personaPickerOpen,
    isAccountMenuOpen,
    isEditingGoalHeader,
  });
  navStateRef.current = {
    activeTab,
    selectedGoalId,
    isModalOpen,
    managingAssignedGoal,
    giveUpTargetGoal,
    personaPickerOpen,
    isAccountMenuOpen,
    isEditingGoalHeader,
  };

  useEffect(() => {
    if (!user) return;
    // Trap so the first system-back press fires popstate while we are inside.
    try {
      window.history.pushState({ goalPathBackTrap: true }, '');
    } catch {
      /* history unavailable (e.g. tests) - in-app tabs still work */
    }

    const reTrap = () => {
      try {
        window.history.pushState({ goalPathBackTrap: true }, '');
      } catch {
        /* ignore */
      }
    };

    const goHome = () => {
      setTabDirection(-1);
      setSelectedGoalId(null);
      setActiveTab('dashboard');
      window.scrollTo({ top: 0, behavior: 'auto' });
    };

    const handlePopState = () => {
      const s = navStateRef.current;

      // 1. Close topmost layer first.
      if (s.isAccountMenuOpen) {
        setIsAccountMenuOpen(false);
        reTrap();
        return;
      }
      if (s.isModalOpen) {
        setIsModalOpen(false);
        reTrap();
        return;
      }
      if (s.managingAssignedGoal) {
        setManagingAssignedGoal(null);
        reTrap();
        return;
      }
      if (s.giveUpTargetGoal) {
        setGiveUpTargetGoal(null);
        reTrap();
        return;
      }
      if (s.personaPickerOpen) {
        setPersonaPickerOpen(false);
        reTrap();
        return;
      }
      if (s.isEditingGoalHeader) {
        setIsEditingGoalHeader(false);
        reTrap();
        return;
      }

      // 2. Goal detail -> Goals home.
      if (s.activeTab === 'detail' || s.selectedGoalId) {
        goHome();
        reTrap();
        return;
      }

      // 3. Any other tab (Today / Connect / Profile) -> Goals home.
      if (s.activeTab !== 'dashboard') {
        goHome();
        reTrap();
        return;
      }

      // 4. Already on Goals: ask for a second back within 2s to leave.
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        setExitPromptVisible(false);
        // No re-trap: let the browser actually go back / close the app.
        return;
      }
      lastBackPressRef.current = now;
      setExitPromptVisible(true);
      reTrap();
      if (exitPromptTimerRef.current !== null) {
        window.clearTimeout(exitPromptTimerRef.current);
      }
      exitPromptTimerRef.current = window.setTimeout(() => {
        setExitPromptVisible(false);
      }, 2000);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (exitPromptTimerRef.current !== null) {
        window.clearTimeout(exitPromptTimerRef.current);
      }
    };
  }, [user]);

  // The pill that glides between tabs, measured separately for each bar.
  const desktopNav = useSegmentedTrack(activeTab);
  const phoneNav = useSegmentedTrack(activeTab);

  // One button in the phone tab bar.
  const renderNavButton = ({ key, label, Icon, badge }: NavTab) => {
    const active = isTabActive(key);
    return (
      <button
        key={key}
        type="button"
        onClick={() => selectTab(key)}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        data-active={active}
        style={{ gap: '2px' }}
        className="segmented-tab flex-1 min-w-0 flex-col py-2 cursor-pointer"
      >
        <Icon
          className={`w-5 h-5 transition-transform duration-300 ${active ? 'scale-110' : ''}`}
        />
        <span className="text-[10px] font-bold leading-none">{label}</span>
        {badge > 0 && (
          <span className="absolute top-0.5 right-1/4 min-w-[15px] h-[15px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center leading-none shadow-2xs">
            {badge}
          </span>
        )}
      </button>
    );
  };

  const masterDateTasks = useMemo(() => {
    return goals.flatMap((g) =>
      (g.tasks || [])
        .filter((t) => t.date === dailyMasterDate)
        .map((t) => ({
          ...t,
          goalTitle: g.title,
          goalId: g.id,
          subcategoryName:
            (g.subcategories || []).find((s) => s.id === t.subcategoryId)?.name || '',
          editorRole:
            (g.subcategories || []).find((s) => s.id === t.subcategoryId)?.editorRole || null,
        }))
    );
  }, [goals, dailyMasterDate]);

  const masterTasksByDate = useMemo(() => {
    const map: Record<string, { total: number; done: number }> = {};
    goals.forEach((g) => {
      (g.tasks || []).forEach((t) => {
        if (!map[t.date]) {
          map[t.date] = { total: 0, done: 0 };
        }
        map[t.date].total += 1;
        if (t.completed) map[t.date].done += 1;
      });
    });
    return map;
  }, [goals]);

  const totalMilestonesCount = useMemo(() => {
    return goals.reduce((acc, g) => acc + (g.milestones ? g.milestones.length : 0), 0);
  }, [goals]);

  const completedMilestonesCount = useMemo(() => {
    return goals.reduce(
      (acc, g) => acc + (g.milestones ? g.milestones.filter((m) => m.completed).length : 0),
      0
    );
  }, [goals]);

  const overallProgress =
    totalMilestonesCount > 0
      ? Math.round((completedMilestonesCount / totalMilestonesCount) * 100)
      : 0;

  // Filtered Goals
  const filteredGoals = useMemo(() => {
    return goals.filter((g) => {
      const matchQuery =
        g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (g.description && g.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchCat = selectedCategory === 'all' || g.category === selectedCategory;
      return matchQuery && matchCat;
    });
  }, [goals, searchQuery, selectedCategory]);

  const categories = useMemo(() => {
    const set = new Set(goals.map((g) => g.category).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [goals]);

  // AUTH ACTIONS
  const handleGoogleSignIn = async () => {
    // A second click while a popup is open cancels it and opens another one.
    if (googleSignInBusy.current) return;
    googleSignInBusy.current = true;
    setAuthError(null);
    setAuthNotice(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const authErr = err as { code?: string; message?: string };
      console.error('Google Sign In Error:', err);

      // Only a popup that could not open at all is a reason to leave the page.
      // Embedded browsers such as a preview pane hand back no window, which
      // Firebase reports as "popup-blocked"; a full-page redirect still works there.
      if (
        authErr.code === 'auth/popup-blocked' ||
        authErr.code === 'auth/operation-not-supported-in-this-environment'
      ) {
        setAuthNotice(
          'This browser would not open the Google sign-in popup, so you are being taken to Google’s sign-in page instead…'
        );
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectErr: unknown) {
          const rErr = redirectErr as { message?: string };
          console.error('Google redirect sign-in error:', redirectErr);
          setAuthNotice(null);
          setAuthError(rErr.message || 'Google sign-in failed. Please try again.');
        }
        return;
      }

      // Closing the window, or starting another attempt, is the person's own
      // choice. It is not a failure, and never a reason to navigate away.
      if (authErr.code === 'auth/popup-closed-by-user') {
        setAuthNotice(
          'The sign-in window was closed before it finished. Choose “Continue with Google” to try again.'
        );
        return;
      }
      if (authErr.code === 'auth/cancelled-popup-request') return;

      setAuthError(authErr.message || 'Failed to sign in with Google. Please try again.');
    } finally {
      googleSignInBusy.current = false;
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setSelectedGoalId(null);
      setActiveTab('dashboard');
      setWorkspaceUid(null);
    } catch (err) {
      console.error('Sign Out Error:', err);
      setErrorMessage('Failed to sign out.');
    }
  };

  // FIRESTORE / LOCAL GOAL ACTIONS
  /**
   * Records the answer to "how will you use Goal Path?".
   * Purely descriptive: it changes what this account sees, not what it may read.
   * Access to anyone else's data still runs through the approval flow.
   */
  const handleChoosePersona = async (persona: AccountPersona) => {
    if (!user) return;
    setSavingPersona(true);
    try {
      const chosenAt = new Date().toISOString();
      await updateDoc(doc(db, 'users', user.uid), { persona, personaChosenAt: chosenAt });
      setProfile((prev) => (prev ? { ...prev, persona, personaChosenAt: chosenAt } : prev));
      setPersonaPromptDismissed(true);
      setPersonaPickerOpen(false);
      if (persona === 'professional') {
        setActiveTab('professional');
      }
    } catch (err) {
      console.error('Save persona error:', err);
      setErrorMessage('Could not save your choice. Check permissions and try again.');
    } finally {
      setSavingPersona(false);
    }
  };

  /**
   * Saves one goal from a plan: the goal, a checkpoint for each month, and (when
   * asked) the plan's routines written onto the calendar. Returns the new goal's id.
   * Shared by the first-time questions and the guided "create a goal" flow.
   */
  const createGoalFromPlan = async (
    plan: StarterPlan,
    withRoutines: boolean,
    index = 0
  ): Promise<string | null> => {
    if (!user) return null;
    const startKey = getCurrentMonthKey();
    const targetDate = addMonthsToKey(startKey, plan.months);
    const monthKeys = generateMonthRange(startKey, targetDate);
    const milestones: Milestone[] = monthKeys.map((mKey, idx) => ({
      id: `m-${Date.now()}-${index}-${idx}`,
      monthKey: mKey,
      title:
        idx === monthKeys.length - 1
          ? `Final: Complete ${plan.title}`
          : `Checkpoint for ${formatMonthKey(mKey)}`,
      completed: false,
    }));

    const planned = withRoutines
      ? materializePlan(plan, {
          fromDate: todayDate,
          endDate: goalEndDate({ targetDate, milestones }),
          seed: Date.now() + index * 1000,
        })
      : { subcategories: [] as Subcategory[], tasks: [] as TaskItem[] };

    // A long goal with many routines can outgrow one Firestore document; say so instead of failing at the database.
    if (!fitsInGoalDocument(planned.subcategories, planned.tasks)) return null;

    const docRef = await addDoc(collection(db, 'goals'), {
      userId: user.uid,
      title: plan.title,
      category: plan.category,
      description: plan.description,
      createdAt: todayDate,
      targetDate,
      milestones,
      subcategories: planned.subcategories,
      tasks: planned.tasks,
      viewerUids: [],
      editorUids: [],
    });
    return docRef.id;
  };

  /**
   * Finishes the first-run questions: records the answers on the profile and,
   * for someone planning their own goals, creates a goal for each thing they
   * chose to work on, with the starter routines already written onto the
   * calendar. Returns the ids of the goals it created.
   */
  const handleFinishOnboarding = async (
    answers: OnboardingAnswers,
    plans: StarterPlan[]
  ): Promise<string[]> => {
    if (!user) return [];
    const chosenAt = new Date().toISOString();
    const createdIds: string[] = [];

    for (const plan of plans) {
      const id = await createGoalFromPlan(plan, answers.starter, createdIds.length);
      if (id) createdIds.push(id);
    }

    // Firestore rejects undefined, so only answered questions are stored.
    const stored: Record<string, unknown> = {
      focus: answers.focus,
      days: answers.days,
      minutes: answers.minutes,
      months: answers.months,
      starter: answers.starter,
    };
    if (answers.age) stored.age = answers.age;
    if (answers.eating) stored.eating = answers.eating;
    if (answers.activity) stored.activity = answers.activity;

    await updateDoc(doc(db, 'users', user.uid), {
      persona: answers.persona,
      personaChosenAt: chosenAt,
      onboardedAt: chosenAt,
      onboarding: stored,
    });
    setProfile((prev) =>
      prev ? { ...prev, persona: answers.persona, personaChosenAt: chosenAt, onboardedAt: chosenAt } : prev
    );
    return createdIds;
  };

  /** Leaves the questions, straight into the first new goal when there is one. */
  const handleCloseOnboarding = (openGoalId?: string) => {
    setPersonaPromptDismissed(true);
    setPersonaPickerOpen(false);
    if (openGoalId) openGoal(openGoalId);
    else if (profile?.persona === 'professional') setActiveTab('professional');
  };

  /** Saves a goal made in the guided flow and opens it. */
  const handleCreateGuidedGoal = async (plan: StarterPlan): Promise<string | null> => {
    try {
      const id = await createGoalFromPlan(plan, true);
      if (id) setSuccessMessage(`“${plan.title}” is ready. Edit anything you like.`);
      return id;
    } catch (err) {
      console.error('Create guided goal error:', err);
      setErrorMessage('Could not create the goal. Please try again.');
      return null;
    }
  };

  const handleCreateGoal = async (newGoalData: {
    title: string;
    category: string;
    description: string;
    targetDate: string;
    assignedProfessionalUids?: string[];
  }) => {
    if (!user || !isOwner) return;
    const startKey = getCurrentMonthKey();
    const months = generateMonthRange(startKey, newGoalData.targetDate);

    const milestones: Milestone[] = months.map((mKey, idx) => ({
      id: `m-${Date.now()}-${idx}`,
      monthKey: mKey,
      title:
        idx === months.length - 1
          ? `Final: Complete ${newGoalData.title}`
          : `Checkpoint for ${formatMonthKey(mKey)}`,
      completed: false,
    }));

    const newGoalId = `goal-${Date.now()}`;
    const docData: Goal = {
      id: newGoalId,
      userId: user.uid,
      title: newGoalData.title,
      category: newGoalData.category || 'General',
      description: newGoalData.description || '',
      createdAt: todayDate,
      targetDate: newGoalData.targetDate,
      milestones,
      subcategories: [],
      tasks: [],
    };

    try {
      const docRef = await addDoc(collection(db, 'goals'), docData);
      const createdId = docRef.id;

      // Professionals picked during creation start with editing access. The goal
      // document gets the access lists Firestore enforces, and the owner's roster
      // records the same permission so both stay in step.
      const assignedUids = newGoalData.assignedProfessionalUids || [];
      if (assignedUids.length > 0) {
        const userRef = doc(db, 'users', user.uid);
        const fresh = await getDoc(userRef);
        const data = fresh.data() || {};
        const collaborators: Collaborator[] = data.collaborators || [];

        const updatedCollabs: Collaborator[] = collaborators.map((c) =>
          assignedUids.includes(c.uid)
            ? {
                ...c,
                goalAccess: { ...(c.goalAccess || {}), [createdId]: 'edit' as GoalAccessLevel },
              }
            : c
        );

        await updateDoc(userRef, { collaborators: updatedCollabs });

        const { viewerUids, editorUids } = buildGoalAccessArrays(updatedCollabs, createdId);
        await updateDoc(doc(db, 'goals', createdId), { viewerUids, editorUids });
      }

      // Firestore echoes the new document back a moment later. Until it does,
      // the detail view has nothing to render and the screen would sit blank,
      // so hand the list the goal we just created straight away.
      const createdGoal: Goal = { ...docData, id: createdId };
      setGoals((prev) =>
        prev.some((g) => g.id === createdId) ? prev : [createdGoal, ...prev]
      );
      setSelectedGoalId(createdId);
      setActiveTab('detail');
    } catch (err) {
      console.error('Create Goal error:', err);
      setErrorMessage('Could not save goal to Firestore. Check permissions.');
    }
  };

  const handleUpdateGoalDetails = async (
    goalId: string,
    updates: { title?: string; category?: string; description?: string }
  ) => {
    // Title, category and description are owner-only: the security rules never
    // let a collaborator change them.
    if (!isOwner) {
      setErrorMessage('Only the goal owner can change these details.');
      return;
    }
    const targetGoal = goals.find((g) => g.id === goalId);
    if (!targetGoal) return;

    try {
      await updateDoc(doc(db, 'goals', goalId), updates);
    } catch (err) {
      console.error('Update goal details error:', err);
      setErrorMessage('Failed to update goal details.');
    }
  };

  const handleGiveUpGoal = async (goalId: string) => {
    if (!isOwner) return;

    try {
      await deleteDoc(doc(db, 'goals', goalId));
      if (selectedGoalId === goalId) {
        setSelectedGoalId(null);
        setActiveTab('dashboard');
      }
    } catch (err) {
      console.error('Give Up Goal error:', err);
      setErrorMessage('Failed to give up on goal.');
    }
  };

  const handleExtendGoalDeadline = async (goalId: string, monthsToAdd: number = 1) => {
    const targetGoal = goals.find((g) => g.id === goalId);
    if (!targetGoal) return;

    const count = Math.max(1, monthsToAdd);
    const lastMonthKey =
      targetGoal.milestones.length > 0
        ? targetGoal.milestones[targetGoal.milestones.length - 1].monthKey
        : targetGoal.targetDate || getCurrentMonthKey();

    const newMilestones: Milestone[] = [];
    for (let i = 1; i <= count; i++) {
      const nextMonthKey = addMonthsToKey(lastMonthKey, i);
      newMilestones.push({
        id: `m-${Date.now()}-${i}`,
        monthKey: nextMonthKey,
        title: `Extended Focus (${formatFullMonth(nextMonthKey)})`,
        completed: false,
      });
    }

    const finalTargetDate = addMonthsToKey(lastMonthKey, count);
    const updatedMilestones = [...targetGoal.milestones, ...newMilestones];
    const updatedTargetDate = finalTargetDate > targetGoal.targetDate ? finalTargetDate : targetGoal.targetDate;

    try {
      await updateDoc(doc(db, 'goals', goalId), {
        targetDate: updatedTargetDate,
        milestones: updatedMilestones,
      });
      setSuccessMessage(`Added +${count} ${count === 1 ? 'month' : 'months'} to "${targetGoal.title}"! New horizon: ${formatFullMonth(updatedTargetDate)}. Progress is progress!`);
    } catch (err) {
      console.error('Extend goal error:', err);
      setErrorMessage('Failed to extend goal timeline.');
    }
  };

  const handleToggleMilestone = async (goalId: string, milestoneId: string) => {
    if (!canEditGoal(goalId)) return;
    const targetGoal = goals.find((g) => g.id === goalId);
    if (!targetGoal) return;

    const updatedMilestones = targetGoal.milestones.map((m) =>
      m.id === milestoneId ? { ...m, completed: !m.completed } : m
    );

    try {
      await updateDoc(doc(db, 'goals', goalId), {
        milestones: updatedMilestones,
      });
    } catch (err) {
      console.error('Update milestone error:', err);
      setErrorMessage('Failed to update milestone status.');
    }
  };

  const handleUpdateMilestoneTitle = async (goalId: string, milestoneId: string, title: string) => {
    if (!canEditGoal(goalId)) return;
    const targetGoal = goals.find((g) => g.id === goalId);
    if (!targetGoal) return;

    const updatedMilestones = targetGoal.milestones.map((m) =>
      m.id === milestoneId ? { ...m, title } : m
    );

    try {
      await updateDoc(doc(db, 'goals', goalId), {
        milestones: updatedMilestones,
      });
    } catch (err) {
      console.error('Update milestone title error:', err);
      setErrorMessage('Failed to rename milestone.');
    }
  };

  const handleAddSubcategory = async (goalId: string, name: string, date?: string): Promise<string | null> => {
    if (!canEditGoal(goalId)) return null;
    const targetGoal = goals.find((g) => g.id === goalId);
    if (!targetGoal) return null;

    const newSub: Subcategory = {
      id: `sc-${Date.now()}`,
      name,
      order: (targetGoal.subcategories || []).length,
      date: date || todayDate,
      editorRole: isOwner ? null : (professionalRole || null),
    };

    try {
      await updateDoc(doc(db, 'goals', goalId), {
        subcategories: [...(targetGoal.subcategories || []), newSub],
      });
      return newSub.id;
    } catch (err) {
      console.error('Add subcategory error:', err);
      setErrorMessage('Failed to add sub-category.');
      return null;
    }
  };

  /**
   * One goal is one Firestore document, and a weekly routine multiplies the days
   * and tasks in it. A change that would push the plan past the size budget is
   * refused here, with a plain message, instead of failing at the database.
   */
  const fitsInGoalDocument = (subcategories: Subcategory[], tasks: TaskItem[]): boolean => {
    if (estimateBytes({ subcategories, tasks }) <= MAX_GOAL_CONTENT_BYTES) return true;
    setErrorMessage(
      'That would make this goal too large to save. Repeat it on fewer days, or add fewer tasks to it.'
    );
    return false;
  };

  /** A routine: the same subcategory on every chosen weekday until the goal ends. */
  const handleAddRepeatingSubcategory = async (
    goalId: string,
    name: string,
    fromDate: string,
    pattern: RepeatPattern
  ): Promise<string | null> => {
    if (!canEditGoal(goalId)) return null;
    const targetGoal = goals.find((g) => g.id === goalId);
    if (!targetGoal) return null;

    const created = createSeries({
      subcategories: targetGoal.subcategories || [],
      tasks: targetGoal.tasks || [],
      name,
      pattern,
      fromDate,
      endDate: goalEndDate(targetGoal),
      editorRole: isOwner ? null : professionalRole || null,
    });
    if (!created) {
      setErrorMessage('There is no matching day left in this goal to repeat on.');
      return null;
    }
    if (!fitsInGoalDocument(created.subcategories, created.tasks)) return null;

    try {
      await updateDoc(doc(db, 'goals', goalId), { subcategories: created.subcategories });
      setSuccessMessage(
        `“${name}” added to ${created.count} ${created.count === 1 ? 'day' : 'days'}: ${describePattern(pattern)}.`
      );
      return created.firstId;
    } catch (err) {
      console.error('Add repeating subcategory error:', err);
      setErrorMessage('Failed to add the weekly routine.');
      return null;
    }
  };

  /**
   * Changes the weekdays a routine runs on from this day forward. An empty list
   * stops it. Earlier days are history and are left alone.
   */
  const handleChangeSubcategoryRepeat = async (
    goalId: string,
    subcategoryId: string,
    days: number[],
    everyWeeks?: number
  ) => {
    if (!canEditGoal(goalId)) return;
    const targetGoal = goals.find((g) => g.id === goalId);
    const sub = targetGoal?.subcategories?.find((s) => s.id === subcategoryId);
    if (!targetGoal || !sub || !sub.date) return;
    if (!canEditSubcategoryTasks(goalId, sub)) {
      setErrorMessage('You do not have permission to change this subcategory.');
      return;
    }

    const result = applySeriesDays({
      subcategories: targetGoal.subcategories || [],
      tasks: targetGoal.tasks || [],
      anchor: sub,
      days,
      everyWeeks,
      endDate: goalEndDate(targetGoal),
    });
    if (!fitsInGoalDocument(result.subcategories, result.tasks)) return;

    try {
      await updateDoc(doc(db, 'goals', goalId), {
        subcategories: result.subcategories,
        tasks: result.tasks,
      });
      setSuccessMessage(
        days.length === 0
          ? `“${sub.name}” no longer repeats.`
          : `“${sub.name}” now repeats: ${describePattern({ kind: 'weekly', days, everyWeeks: everyWeeks ?? sub.repeatEvery ?? 1 })}.`
      );
    } catch (err) {
      console.error('Change repeat error:', err);
      setErrorMessage('Failed to change how this repeats.');
    }
  };

  /** Renames this subcategory and, if it is part of a routine, the later days too. */
  const handleRenameSubcategory = async (goalId: string, subcategoryId: string, name: string) => {
    if (!canEditGoal(goalId)) return;
    const targetGoal = goals.find((g) => g.id === goalId);
    if (!targetGoal) return;

    const sub = (targetGoal.subcategories || []).find((s) => s.id === subcategoryId);
    if (!sub) return;
    const updatedSubcategories = updateFrom(targetGoal.subcategories || [], sub, { name });

    try {
      await updateDoc(doc(db, 'goals', goalId), {
        subcategories: updatedSubcategories,
      });
    } catch (err) {
      console.error('Rename subcategory error:', err);
      setErrorMessage('Failed to rename sub-category.');
    }
  };

  /**
   * Deletes a subcategory and its tasks. For a routine, `future` deletes this day
   * and every later day of it; `one` deletes just this day.
   */
  const handleDeleteSubcategory = async (
    goalId: string,
    subcategoryId: string,
    scope: 'one' | 'future' = 'one'
  ) => {
    if (!canEditGoal(goalId)) return;

    const targetGoal = goals.find((g) => g.id === goalId);
    if (!targetGoal) return;

    const sub = (targetGoal.subcategories || []).find((s) => s.id === subcategoryId);
    if (!sub) return;
    const ids = new Set(
      scope === 'future'
        ? occurrencesFrom(targetGoal.subcategories || [], sub).map((s) => s.id)
        : []
    );
    ids.add(subcategoryId);

    const { subcategories: updatedSubcategories, tasks: updatedTasks } = removeSubcategories(
      { subcategories: targetGoal.subcategories || [], tasks: targetGoal.tasks || [] },
      ids
    );

    try {
      await updateDoc(doc(db, 'goals', goalId), {
        subcategories: updatedSubcategories,
        tasks: updatedTasks,
      });
    } catch (err) {
      console.error('Delete subcategory error:', err);
      setErrorMessage('Failed to delete sub-category.');
    }
  };

  const handleSetSubcategoryRole = async (goalId: string, subcategoryId: string, editorRole: string) => {
    if (!canEditGoal(goalId)) return;
    const targetGoal = goals.find((g) => g.id === goalId);
    if (!targetGoal) return;

    const sub = (targetGoal.subcategories || []).find((s) => s.id === subcategoryId);
    if (!sub) return;
    const updatedSubcategories = updateFrom(targetGoal.subcategories || [], sub, {
      editorRole: editorRole || null,
    });

    try {
      await updateDoc(doc(db, 'goals', goalId), {
        subcategories: updatedSubcategories,
      });
    } catch (err) {
      console.error('Set subcategory role error:', err);
      setErrorMessage('Failed to update sub-category access.');
    }
  };

  const handleAddTask = async (
    goalId: string,
    text: string,
    priority: 'high' | 'medium' | 'low',
    subcategoryId?: string,
    date?: string,
    forward?: boolean
  ) => {
    const targetGoal = goals.find((g) => g.id === goalId);
    if (!targetGoal) return;

    if (!canEditGoal(goalId)) return;

    // Part of a weekly routine: put the task on this day and every later day of it.
    const anchor = forward
      ? (targetGoal.subcategories || []).find((s) => s.id === subcategoryId)
      : undefined;
    if (anchor) {
      const nextTasks = addTaskForward({
        subcategories: targetGoal.subcategories || [],
        tasks: targetGoal.tasks || [],
        anchor,
        text,
        priority: priority || 'medium',
        forward: true,
      });
      if (!fitsInGoalDocument(targetGoal.subcategories || [], nextTasks)) return;
      try {
        await updateDoc(doc(db, 'goals', goalId), { tasks: nextTasks });
      } catch (err) {
        console.error('Add task error:', err);
        setErrorMessage('Failed to add task.');
      }
      return;
    }

    const newTask: TaskItem = {
      id: `t-${Date.now()}`,
      text,
      priority: priority || 'medium',
      completed: false,
      date: date || todayDate,
      subcategoryId: subcategoryId || '',
    };

    try {
      await updateDoc(doc(db, 'goals', goalId), {
        tasks: [newTask, ...targetGoal.tasks],
      });
    } catch (err) {
      console.error('Add task error:', err);
      setErrorMessage('Failed to add task.');
    }
  };

  const handleToggleTask = async (goalId: string, taskId: string) => {
    const targetGoal = goals.find((g) => g.id === goalId);
    if (!targetGoal) return;
    const task = (targetGoal.tasks || []).find((t) => t.id === taskId);
    if (!task || !canEditTaskRecord(goalId, task)) {
      setErrorMessage('You do not have permission to edit this task.');
      return;
    }

    const updatedTasks = targetGoal.tasks.map((t) =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );

    try {
      await updateDoc(doc(db, 'goals', goalId), {
        tasks: updatedTasks,
      });
    } catch (err) {
      console.error('Toggle task error:', err);
      setErrorMessage('Failed to update task.');
    }
  };

  const handleDeleteTask = async (goalId: string, taskId: string) => {
    const targetGoal = goals.find((g) => g.id === goalId);
    if (!targetGoal) return;
    const task = (targetGoal.tasks || []).find((t) => t.id === taskId);
    if (!task || !canEditTaskRecord(goalId, task)) {
      setErrorMessage('You do not have permission to delete this task.');
      return;
    }

    const updatedTasks = targetGoal.tasks.filter((t) => t.id !== taskId);

    try {
      await updateDoc(doc(db, 'goals', goalId), {
        tasks: updatedTasks,
      });
    } catch (err) {
      console.error('Delete task error:', err);
      setErrorMessage('Failed to delete task.');
    }
  };

  const handleUpdateTask = async (
    goalId: string,
    taskId: string,
    updates: Partial<TaskItem>
  ) => {
    const targetGoal = goals.find((g) => g.id === goalId);
    if (!targetGoal) return;
    const task = (targetGoal.tasks || []).find((t) => t.id === taskId);
    if (!task || !canEditTaskRecord(goalId, task)) {
      setErrorMessage('You do not have permission to edit this task.');
      return;
    }

    const updatedTasks = targetGoal.tasks.map((t) =>
      t.id === taskId ? { ...t, ...updates } : t
    );

    try {
      await updateDoc(doc(db, 'goals', goalId), {
        tasks: updatedTasks,
      });
    } catch (err) {
      console.error('Update task error:', err);
      setErrorMessage('Failed to update task.');
    }
  };

  const handleRequestAccess = async (rawCode: string, role: ProfessionalRole) => {
    if (!user) return;
    setConnectNotice(null);
    const code = (rawCode || '').trim().toUpperCase();
    if (!code || code.length !== 6) {
      setConnectNotice({ type: 'error', text: 'Enter a 6-character access code.' });
      return;
    }
    if (!PROFESSIONAL_ROLES.includes(role)) {
      setConnectNotice({ type: 'error', text: 'Choose a professional role.' });
      return;
    }
    if (profile?.code && code === profile.code) {
      setConnectNotice({ type: 'error', text: 'That is your own code. Share it with a client instead.' });
      return;
    }

    try {
      const codeSnap = await getDoc(doc(db, 'codes', code));
      if (!codeSnap.exists()) {
        setConnectNotice({ type: 'error', text: 'No account found for that code.' });
        return;
      }
      const toUid = codeSnap.data().uid;
      if (toUid === user.uid) {
        setConnectNotice({ type: 'error', text: 'You cannot connect to your own account.' });
        return;
      }

      // Ask with a query rather than reading the request document directly.
      // Reading a document that does not exist yet is refused by the security
      // rules, so a first-time request used to fail as "permission denied".
      const existingSnap = await getDocs(
        query(
          collection(db, 'accessRequests'),
          where('fromUid', '==', user.uid),
          where('toUid', '==', toUid)
        )
      );
      const existing = existingSnap.docs[0];

      if (existing) {
        const status = existing.data().status;
        if (status === 'pending') {
          setConnectNotice({ type: 'error', text: 'A request is already waiting for this client.' });
          return;
        }
        if (status === 'approved') {
          setConnectNotice({ type: 'error', text: 'You already have access to this client.' });
          return;
        }
        // Denied or removed before: re-open the existing request. Overwriting it
        // would count as changing more than the status, which the rules refuse.
        await updateDoc(existing.ref, {
          status: 'pending',
          role,
          createdAt: new Date().toISOString(),
        });
        setConnectNotice({ type: 'ok', text: 'Request sent again. The client must approve it.' });
        // Asking again clears an earlier removal, so the client comes back into
        // the list once they approve.
        await clearWithdrawnClient(toUid);
        return;
      }

      await setDoc(doc(db, 'accessRequests', requestDocId(user.uid, toUid)), {
        fromUid: user.uid,
        fromName: user.displayName || user.email || 'Professional',
        fromEmail: user.email || '',
        fromPhoto: user.photoURL || '',
        toUid,
        toCode: code,
        role,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      setConnectNotice({ type: 'ok', text: 'Request sent. The client must approve it.' });
      await clearWithdrawnClient(toUid);
    } catch (err: unknown) {
      console.error('Request access error:', err);
      const msg = err instanceof Error ? err.message : 'Could not send request. Please try again.';
      setConnectNotice({
        type: 'error',
        text: msg.includes('permission') || msg.includes('PERMISSION')
          ? 'Permission denied. Please ensure you are signed in and try again.'
          : msg,
      });
    }
  };

  /**
   * Pushes the owner's collaborator permissions onto the goal documents, which
   * is what the Firestore rules read. Goals not passed in are left untouched.
   */
  const syncGoalAccess = async (
    collaborations: Collaborator[],
    goalIds?: string[]
  ): Promise<void> => {
    const targets = goalIds ? goals.filter((g) => goalIds.includes(g.id)) : goals;

    for (const goal of targets) {
      const { viewerUids, editorUids } = buildGoalAccessArrays(collaborations, goal.id);
      if (
        (goal.viewerUids || []).join(',') === viewerUids.join(',') &&
        (goal.editorUids || []).join(',') === editorUids.join(',')
      ) {
        continue;
      }
      try {
        await updateDoc(doc(db, 'goals', goal.id), { viewerUids, editorUids });
      } catch (err) {
        console.error('Sync goal access error:', err);
        setErrorMessage('Saved the assignment but could not update goal access.');
      }
    }
  };

  const handleApproveRequest = async (
    request: AccessRequest,
    goalAccess: Record<string, GoalAccessLevel>
  ) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const fresh = await getDoc(userRef);
      const data = fresh.data() || {};
      const collaborators: Collaborator[] = data.collaborators || [];
      const collaboratorUids: string[] = data.collaboratorUids || [];

      const updatedCollaborators: Collaborator[] = [
        ...collaborators.filter((c) => c.uid !== request.fromUid),
        {
          uid: request.fromUid,
          role: request.role,
          addedAt: new Date().toISOString(),
          name: request.fromName || '',
          email: request.fromEmail || '',
          goalAccess,
        },
      ];

      const updatedUids = Array.from(new Set([...collaboratorUids, request.fromUid]));

      await updateDoc(userRef, {
        collaborators: updatedCollaborators,
        collaboratorUids: updatedUids,
      });

      await updateDoc(doc(db, 'accessRequests', request.id), { status: 'approved' });

      await syncGoalAccess(updatedCollaborators);
    } catch (err) {
      console.error('Approve request error:', err);
      setErrorMessage('Failed to approve request.');
    }
  };

  const handleUpdateAssignedGoals = async (
    professionalUid: string,
    goalAccess: Record<string, GoalAccessLevel>
  ) => {
    if (!user) return;

    const applyAccess = (collaborators: Collaborator[]): Collaborator[] =>
      collaborators.map((c) => {
        if (c.uid !== professionalUid) return c;
        const next: Collaborator = { ...c, goalAccess };
        delete next.assignedGoalIds;
        return next;
      });

    try {
      const userRef = doc(db, 'users', user.uid);
      const fresh = await getDoc(userRef);
      const data = fresh.data() || {};
      const collaborators: Collaborator[] = data.collaborators || [];

      const updated = applyAccess(collaborators);

      await updateDoc(userRef, {
        collaborators: updated,
      });

      await syncGoalAccess(updated);
    } catch (err) {
      console.error('Update assigned goals error:', err);
      setErrorMessage('Failed to update assigned goals.');
    }
  };

  const handleSaveGoalCollaboratorAssignments = async (
    goalId: string,
    assignments: Record<string, GoalAccessLevel>
  ) => {
    if (!user || !isOwner) return;

    const applyAssignments = (collaborators: Collaborator[]): Collaborator[] =>
      collaborators.map((c) => {
        const level = assignments[c.uid];
        const goalAccess = { ...(c.goalAccess || {}) };
        if (level === 'view' || level === 'edit') {
          goalAccess[goalId] = level;
        } else {
          delete goalAccess[goalId];
        }
        const next: Collaborator = { ...c, goalAccess };
        delete next.assignedGoalIds;
        return next;
      });

    try {
      const userRef = doc(db, 'users', user.uid);
      const fresh = await getDoc(userRef);
      const data = fresh.data() || {};
      const collaborators: Collaborator[] = data.collaborators || [];

      const updated = applyAssignments(collaborators);

      await updateDoc(userRef, {
        collaborators: updated,
      });

      await syncGoalAccess(updated, [goalId]);
    } catch (err) {
      console.error('Update goal collaborator assignments error:', err);
      setErrorMessage('Failed to update assigned professionals for this goal.');
    }
  };

  const handleDenyRequest = async (request: AccessRequest) => {
    try {
      await updateDoc(doc(db, 'accessRequests', request.id), { status: 'denied' });
    } catch (err) {
      console.error('Deny request error:', err);
      setErrorMessage('Failed to deny request.');
    }
  };

  const handleRemoveCollaborator = async (professionalUid: string) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const fresh = await getDoc(userRef);
      const data = fresh.data() || {};
      const nextCollaborators = (data.collaborators || []).filter(
        (c: { uid: string }) => c.uid !== professionalUid
      );
      const nextCollaboratorUids = (data.collaboratorUids || []).filter(
        (id: string) => id !== professionalUid
      );

      // Optimistic local state update
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              collaborators: nextCollaborators,
              collaboratorUids: nextCollaboratorUids,
            }
          : null
      );

      await updateDoc(userRef, {
        collaborators: nextCollaborators,
        collaboratorUids: nextCollaboratorUids,
      });

      // Drop the removed professional from every goal's access lists.
      await syncGoalAccess(nextCollaborators);

      // Mark any matching request docs as removed. Done by query, not by reading
      // one document, because a read of a document that does not exist is refused
      // by the rules and used to surface as a failure.
      const q = query(
        collection(db, 'accessRequests'),
        where('fromUid', '==', professionalUid),
        where('toUid', '==', user.uid)
      );
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await updateDoc(d.ref, { status: 'removed' }).catch(() => {});
      }
    } catch (err) {
      console.error('Remove collaborator error:', err);
      setErrorMessage('Failed to remove access.');
    }
  };

  const handleSwitchWorkspace = (uid: string) => {
    setWorkspaceUid(uid);
    setSelectedGoalId(null);
    setActiveTab('dashboard');
  };

  /** Undoes an earlier removal when the professional asks for that client again. */
  const clearWithdrawnClient = async (clientId: string) => {
    if (!user || !clientId || !withdrawnClientIds.includes(clientId)) return;
    const nextWithdrawn = withdrawnClientIds.filter((id) => id !== clientId);
    setWithdrawnClientIds(nextWithdrawn);
    await updateDoc(doc(db, 'users', user.uid), { withdrawnClients: nextWithdrawn }).catch(() => {});
  };

  /**
   * Removes a client from this professional's list.
   *
   * Access is granted by the client's own account, so the professional cannot
   * delete it directly. Instead the client id is recorded on the professional's
   * own profile (which hides the client here, on every device) and the shared
   * request is marked "removed". The client's account clears the professional's
   * access the next time it signs in.
   */
  const handleRemoveClient = async (clientId: string, clientName: string) => {
    if (!user || !clientId) return;
    try {
      const nextWithdrawn = Array.from(new Set([...withdrawnClientIds, clientId]));
      setWithdrawnClientIds(nextWithdrawn);
      if (workspaceUid === clientId) {
        setWorkspaceUid(user.uid);
        setSelectedGoalId(null);
        setActiveTab('dashboard');
      }

      await updateDoc(doc(db, 'users', user.uid), { withdrawnClients: nextWithdrawn });

      const q = query(
        collection(db, 'accessRequests'),
        where('fromUid', '==', user.uid),
        where('toUid', '==', clientId)
      );
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await updateDoc(d.ref, { status: 'removed' }).catch(() => {});
      }

      setSuccessMessage(
        `${clientName} was removed from your client list. Their account drops your access the next time they sign in.`
      );
    } catch (err) {
      console.error('Remove client error:', err);
      setErrorMessage('Could not remove that client. Please try again.');
    }
  };

  /**
   * Leaving professional mode: disconnect from every client and flip the
   * account back to a plain client. Each client link is marked "removed" and
   * recorded as withdrawn, so the client's account drops this access on their
   * next sign-in, the same as removing one client from the Connect tab.
   */
  const handleLeaveProfessional = async () => {
    if (!user) return;
    setSavingPersona(true);
    try {
      const clientIds = visibleClients.map((c) => c.id || '').filter(Boolean);
      if (clientIds.length > 0) {
        const nextWithdrawn = Array.from(new Set([...withdrawnClientIds, ...clientIds]));
        setWithdrawnClientIds(nextWithdrawn);
        await updateDoc(doc(db, 'users', user.uid), { withdrawnClients: nextWithdrawn });
        for (const clientId of clientIds) {
          const q = query(
            collection(db, 'accessRequests'),
            where('fromUid', '==', user.uid),
            where('toUid', '==', clientId)
          );
          const snap = await getDocs(q);
          for (const d of snap.docs) {
            await updateDoc(d.ref, { status: 'removed' }).catch(() => {});
          }
        }
      }

      setWorkspaceUid(user.uid);
      setSelectedGoalId(null);
      const chosenAt = new Date().toISOString();
      await updateDoc(doc(db, 'users', user.uid), { persona: 'client', personaChosenAt: chosenAt });
      setProfile((prev) => (prev ? { ...prev, persona: 'client', personaChosenAt: chosenAt } : prev));
      setActiveTab('professional');
      setSuccessMessage(
        clientIds.length > 0
          ? `You've left professional mode and disconnected from ${clientIds.length} client${
              clientIds.length > 1 ? 's' : ''
            }. You're back to a client account.`
          : "You've left professional mode. You're back to a client account."
      );
    } catch (err) {
      console.error('Leave professional error:', err);
      setErrorMessage('Could not switch back to a client account. Please try again.');
    } finally {
      setSavingPersona(false);
    }
  };

  // LOADING & LOGIN GATES
  if (authLoading || (user && dataLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <GoalPathLoader />
      </div>
    );
  }

  if (!user) {
    return (
      <LoginScreen
        onLogin={handleGoogleSignIn}
        loading={authLoading}
        error={authError}
        info={authNotice}
      />
    );
  }

  return (
    <div
      data-role={isOwner ? 'owner' : 'pro'}
      className={`min-h-screen flex flex-col transition-colors duration-300 ${
        !isOwner
          ? 'selection:bg-blue-200 selection:text-blue-950'
          : 'selection:bg-emerald-100 selection:text-emerald-900'
      } text-slate-900 relative overflow-x-hidden`}
    >
      {/* TRAINER MODE COMMAND BAR: Hoki-tinted relief so working in someone else's
          workspace never looks like your own. */}
      {!isOwner && workspaceProfile && (
        <div className="neu-hoki text-blue-950 px-2.5 sm:px-6 py-1.5 sm:py-2 min-h-[40px] sm:min-h-[44px] flex items-center justify-between gap-2 sm:gap-3 sticky top-0 z-40">
          <div className="min-w-0 flex items-center gap-2 text-xs sm:text-sm font-medium tracking-tight truncate">
            <span className="bg-blue-200/80 text-blue-950 border border-blue-300 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider shadow-2xs shrink-0">
              Trainer Mode
            </span>
            <span className="text-blue-950 font-semibold truncate">
              Managing <span className="font-bold underline decoration-blue-400">{workspaceProfile.displayName || 'Client'}</span>'s Workspace
              {workspaceProfile.email && (
                <span className="hidden sm:inline text-[11px] font-medium text-blue-900/70 ml-1.5">
                  {workspaceProfile.email}
                </span>
              )}
            </span>
          </div>

          {/* SINGLE PRIMARY EXIT BUTTON: KEPT IN CLEAR GREEN INDICATING RETURN TO MAIN WORKSPACE */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleSwitchWorkspace(user.uid)}
              className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-[11px] sm:text-xs px-2.5 sm:px-3.5 py-1.5 rounded-xl border border-emerald-500 shadow-2xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Return to your personal dashboard"
            >
              <ArrowRight className="w-3.5 h-3.5 rotate-180 text-white" />
              <span className="hidden sm:inline">Exit to My Workspace</span>
              <span className="sm:hidden">Exit</span>
            </button>
          </div>
        </div>
      )}

      {/* SUCCESS NOTIFICATION BANNER */}
      {successMessage && (
        <div className={`${
          !isOwner
            ? 'bg-blue-50/95 border-b border-blue-200/90 text-blue-950'
            : 'bg-emerald-50/95 border-b border-emerald-200/90 text-emerald-950'
        } backdrop-blur-md px-4 py-2.5 text-xs font-semibold flex items-center justify-between shadow-2xs animate-in fade-in duration-150`}>
          <div className="flex items-center gap-2">
            <Sparkles className={`w-4 h-4 ${!isOwner ? 'text-blue-600' : 'text-emerald-600'} flex-shrink-0`} />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className={`p-1 ${!isOwner ? 'text-blue-500 hover:text-blue-800' : 'text-emerald-500 hover:text-emerald-800'} ml-4 cursor-pointer`}
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ERROR NOTIFICATION BANNER */}
      {errorMessage && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-xs text-rose-700 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="p-1 text-rose-500 hover:text-rose-800 ml-4 cursor-pointer"
            title="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TOP NAVIGATION BAR */}
      <header
        className={`sticky ${
          !isOwner && workspaceProfile ? 'top-[40px] sm:top-[45px]' : 'top-0'
        } z-30 neu transition-colors duration-200`}
      >
        <div className="max-w-6xl mx-auto px-2.5 sm:px-6 h-12 sm:h-16 flex items-center justify-between gap-2 sm:gap-3">
          {/* Logo / Brand with GoalPath vector integrated */}
          <div
            onClick={() => {
              setSelectedGoalId(null);
              selectTab('dashboard');
            }}
            className="cursor-pointer select-none group flex-shrink-0"
          >
            <GoalPathLogo size="sm" showText={true} />
          </div>

          {/* Right Side Controls: Client Access + New Goal + Account Avatar in ONE Line */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            {/* Minimal Client Workspace Indicator - Single Exit is on top command bar, so no redundant exit here */}
            {!isOwner && workspaceProfile ? (
              <div className="flex items-center gap-1 sm:gap-1.5 bg-blue-50 border border-blue-200/90 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl text-xs shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                <span
                  className="font-bold text-blue-950 text-[11px] sm:text-xs truncate max-w-[96px] sm:max-w-[180px]"
                  title={workspaceProfile.displayName || workspaceProfile.email || 'Client'}
                >
                  {workspaceProfile.displayName || workspaceProfile.email || 'Client'}
                </span>
              </div>
            ) : visibleClients.length > 0 ? (
              <div className="neu-inset-sm flex items-center gap-1 p-0.5 sm:p-1 text-xs font-semibold min-w-0 shrink">
                <span className="text-[10px] text-slate-500 font-bold pl-1 hidden md:inline">
                  Workspace
                </span>
                <AppSelect
                  value={workspaceUid || user.uid}
                  onChange={handleSwitchWorkspace}
                  ariaLabel="Switch workspace"
                  className="neu-sm press px-2.5 py-1.5 rounded-xl text-slate-800 text-[11px] sm:text-xs font-bold w-full min-w-0 max-w-[130px] sm:max-w-[190px]"
                  options={[
                    { value: user.uid, label: 'My Workspace' },
                    ...visibleClients.map((c) => {
                      return {
                        value: c.id || '',
                        label: c.displayName || c.email || 'Client',
                        // Two clients can share a display name, so the email is
                        // what tells them apart in the list.
                        hint: c.email || 'Client',
                      };
                    }),
                  ]}
                />
              </div>
            ) : null}

            {/* Create Goal Button for Owner. Phones use the + in the tab bar instead. */}
            {isOwner && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                aria-label="New Goal"
                data-plain
                className="btn-tone hidden sm:flex text-xs sm:text-sm px-2.5 sm:px-4 py-1.5 sm:py-2 items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                <span className="hidden sm:inline">New Goal</span>
              </button>
            )}

            {/* User Account Avatar (No text sign out in header) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsAccountMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-full pl-0.5 pr-1 py-0.5 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer transition"
                title={user.email || 'Account Settings & Profile'}
              >
                {/* A letter badge rather than the Google photo, which can fail to load */}
                <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold border border-emerald-200 shadow-2xs shrink-0">
                  {(user.email || user.displayName || 'U').charAt(0).toUpperCase()}
                </span>
                <span className="hidden sm:block max-w-[150px] truncate text-xs font-semibold text-slate-600">
                  {user.email}
                </span>
              </button>

              {/* Account Dropdown Menu */}
              {isAccountMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsAccountMenuOpen(false)}
                  />
                  <div role="menu" className="menu pop w-60">
                    <div className="px-2.5 pt-1.5 pb-1">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {user.displayName || 'Goal Path User'}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
                      {!isOwner && (
                        <div className="badge mt-1.5">
                          Active Role: {professionalRole || 'Trainer'}
                        </div>
                      )}
                    </div>
                    <div className="menu-sep" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        setActiveTab('professional');
                      }}
                      className="menu-item"
                    >
                      <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                      <span>
                        {profile?.persona === 'professional'
                          ? 'My professional profile'
                          : 'My profile'}
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        setPersonaPickerOpen(true);
                      }}
                      className="menu-item"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-slate-500" />
                      <span>Start a guided plan</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      data-danger="true"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        handleSignOut();
                      }}
                      className="menu-item"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Announcement bar from the admin */}
      <CmsBanners banners={liveBanners} placement="announcement-bar" />

      {/* VIEW SWITCHER TABS BAR */}
      <div className="hidden sm:block px-2.5 sm:px-6 py-2 sm:py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <nav
            ref={desktopNav.ref}
            data-tone={!isOwner ? 'warm' : 'cool'}
            className="segmented text-xs sm:text-sm font-semibold"
            aria-label="Views"
          >
            <span
              className="segmented-track"
              aria-hidden="true"
              style={{
                transform: `translateX(${desktopNav.track.x}px)`,
                width: desktopNav.track.width,
                opacity: desktopNav.track.ready ? 1 : 0,
              }}
            />
            {navTabs.map(({ key, longLabel, Icon, badge, count }) => {
              const active = isTabActive(key);
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-active={active}
                  onClick={() => selectTab(key)}
                  className="segmented-tab px-3.5 py-2 cursor-pointer"
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{longLabel}</span>
                  {typeof count === 'number' && count > 0 && (
                    <span
                      className={`text-[11px] font-bold tabular-nums ${
                        active ? 'text-violet-800/70' : 'text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                  {badge > 0 && (
                    <span
                      className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full leading-none shrink-0 bg-violet-100 text-violet-900"
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <main
        ref={contentRef}
        className="max-w-6xl mx-auto px-3 sm:px-6 pt-5 pb-28 sm:py-8 flex-1 w-full relative z-10"
      >
        <div key={activeTab} className="tab-panel" data-dir={tabDirection}>
            {/* VIEW 1: ALL GOALS DASHBOARD */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* Inside a client's workspace the big hero is replaced by a single
                    compact line, so the client's goals are what you see first. */}
                {!isOwner && workspaceProfile ? (
                  <div className="neu-hoki rise rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <UsersRound className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="text-xs sm:text-sm font-semibold text-blue-950 truncate">
                        Working in{' '}
                        <span className="font-bold">
                          {workspaceProfile.displayName || 'client'}
                        </span>
                        &apos;s workspace
                      </span>
                      <span className="badge uppercase tracking-wider shrink-0">
                        {professionalRole || 'Trainer'}
                      </span>
                    </div>
                    {workspaceProfile.email && (
                      <span className="w-full sm:w-auto text-[10px] font-medium text-blue-800/80 truncate">
                        {workspaceProfile.email}
                      </span>
                    )}
                    <div className="flex items-center gap-3 text-[11px] font-semibold text-blue-900 tabular-nums">
                      <span>{goals.length} goals</span>
                      <span>
                        {allTodayTasks.filter((t) => t.completed).length}/{allTodayTasks.length} today
                      </span>
                      <span>{overallProgress}%</span>
                      <StreakBadge stats={streakStats} compact />
                    </div>
                  </div>
                ) : (
                  <>
                {/* Dashboard hero: a raised panel, not a picture. In this style the
                    depth is the decoration, so the numbers carry the colour. */}
                <div className="rise neu-lg relative overflow-hidden p-4 sm:p-5">
                  <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <Orb size={52} float className="shrink-0" />
                      <div className="min-w-0 space-y-1">
                        <h1 className="page-title">Your goals</h1>
                        <StreakBadge stats={streakStats} onClick={() => setActiveTab('today')} />
                      </div>
                    </div>

                    {/* Three tappable stats */}
                    <div className="grid grid-cols-3 gap-2.5 sm:gap-3 flex-shrink-0">
                      {/* Stat 1: Goals */}
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById('goals-grid');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="neu-sm press group/card select-none text-center sm:text-left px-3 py-2.5 cursor-pointer"
                        title="Click to view all goals"
                      >
                        <div className="text-lg sm:text-xl font-black text-violet-800">{goals.length}</div>
                        <div className="text-[10px] font-semibold text-slate-600">
                          {!isOwner ? 'Client Goals' : 'Active Goals'}
                        </div>
                        <div className="text-[9px] font-bold text-slate-600 group-hover/card:text-violet-800 flex items-center justify-center sm:justify-start gap-0.5 mt-0.5 transition">
                          <span>View Grid</span>
                          <ArrowRight className="w-2.5 h-2.5 group-hover/card:translate-x-0.5 transition-transform" />
                        </div>
                      </button>

                      {/* Stat 2: Tasks Today */}
                      <button
                        type="button"
                        onClick={() => setActiveTab('today')}
                        className="neu-sm press group/card select-none text-center sm:text-left px-3 py-2.5 cursor-pointer"
                        title="Click to switch to Today's Focus"
                      >
                        <div className="text-lg sm:text-xl font-black text-slate-900">
                          {allTodayTasks.filter((t) => t.completed).length}/{allTodayTasks.length}
                        </div>
                        <div className="text-[10px] font-semibold text-slate-600">
                          Tasks Today
                        </div>
                        <div className="text-[9px] font-bold text-slate-600 group-hover/card:text-violet-800 flex items-center justify-center sm:justify-start gap-0.5 mt-0.5 transition">
                          <span>Focus Mode</span>
                          <ArrowRight className="w-2.5 h-2.5 group-hover/card:translate-x-0.5 transition-transform" />
                        </div>
                      </button>

                      {/* Stat 3: Progress */}
                      <button
                        type="button"
                        onClick={() => {
                          if (goals.length > 0) {
                            setSelectedGoalId(goals[0].id);
                            setActiveTab('detail');
                          }
                        }}
                        className="neu-sm press group/card select-none text-center sm:text-left px-3 py-2.5 cursor-pointer"
                        title="Click to view progress roadmap"
                      >
                        <div className="text-lg sm:text-xl font-black text-slate-900">{overallProgress}%</div>
                        <div className="text-[10px] font-semibold text-slate-600">
                          Progress
                        </div>
                        <div className="text-[9px] font-bold text-slate-600 group-hover/card:text-violet-800 flex items-center justify-center sm:justify-start gap-0.5 mt-0.5 transition">
                          <span>Roadmap</span>
                          <ArrowRight className="w-2.5 h-2.5 group-hover/card:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
                  </>
                )}

                {/* Banner from the admin, above the goal list */}
                {isOwner && <CmsBanners banners={liveBanners} placement="goals-banner" />}

                {/* Clients you work with: one row each, and the whole row is the
                    control, so nobody has to guess that a name is clickable. */}
                {isOwner && visibleClients.length > 0 && (
                  <section className="rise rise-2 neu-deep p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="neu-sm w-9 h-9 rounded-xl grid place-items-center shrink-0">
                          <UsersRound className="w-4 h-4 text-blue-700" />
                        </span>
                        <div className="min-w-0">
                          <h2 className="text-sm sm:text-base font-bold text-slate-800 truncate">
                            Clients you work with
                          </h2>
                          <p className="hidden sm:block text-[11px] text-slate-600 truncate">
                            Open a workspace to plan their routines and tasks.
                          </p>
                        </div>
                      </div>
                      <span className="neu-sm shrink-0 text-[11px] font-bold text-slate-700 px-2.5 py-1 rounded-lg tabular-nums">
                        {visibleClients.length}
                      </span>
                    </div>

                    <ul className="space-y-2.5">
                      {visibleClients.map((client) => {
                        const collab = (client.collaborators || []).find((c) => c.uid === user.uid);
                        // Goals are shared through the client's own records, so the
                        // count has to come from every goal shared with this
                        // professional rather than from the open workspace.
                        const assignedCount = sharedGoals.filter(
                          (g) => g.userId === client.id
                        ).length;
                        const joined =
                          formatJoinedDate(client.createdAt) || formatJoinedDate(collab?.addedAt);
                        const initial = (client.displayName || client.email || 'C')
                          .charAt(0)
                          .toUpperCase();

                        return (
                          <li key={client.id}>
                            <button
                              type="button"
                              onClick={() => handleSwitchWorkspace(client.id || '')}
                              title={`Open ${client.displayName || client.email || 'client'}'s workspace`}
                              className="neu lift group w-full flex items-center gap-3 p-3 rounded-2xl text-left cursor-pointer"
                            >
                              <span className="neu-inset-sm w-10 h-10 rounded-full grid place-items-center text-sm font-black text-violet-800 shrink-0">
                                {initial}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-bold text-slate-800 truncate">
                                  {client.displayName || 'Client'}
                                </span>
                                {/* Two clients can share a name, so the email sits
                                    right under it as the real identifier. */}
                                <span className="block text-[11px] font-medium text-slate-600 truncate">
                                  {client.email}
                                </span>
                                <span className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 flex-wrap">
                                  <Target className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>
                                    {assignedCount === 0
                                      ? 'No sessions assigned'
                                      : `${assignedCount} assigned session${assignedCount > 1 ? 's' : ''}`}
                                  </span>
                                  {joined && <span className="text-slate-500">joined {joined}</span>}
                                </span>
                              </span>
                              <span className="neu-sm shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-bold text-emerald-800">
                                <span>Open</span>
                                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {/* Filter and Search Bar */}
                <div id="goals-grid" className="flex flex-col sm:flex-row items-center justify-between gap-3 scroll-mt-24">
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-2.5 text-slate-600 w-3.5 h-3.5" />
                    <input
                      type="text"
                      placeholder="Search goals or descriptions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full text-xs bg-white border rounded-xl pl-8 pr-3 py-2 text-slate-800 placeholder-slate-500 focus:outline-none ${
                        !isOwner
                          ? 'border-violet-200 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-700'
                          : 'border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600'
                      }`}
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1">
                    <span className="text-xs text-slate-700 font-bold flex-shrink-0">Category:</span>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        data-active={selectedCategory === cat}
                        aria-pressed={selectedCategory === cat}
                        className="chip px-3 py-1.5 text-xs capitalize rounded-full!"
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Goals Grid */}
                {filteredGoals.length === 0 ? (
                  <div className="rise rise-3 neu text-center rounded-2xl p-12">
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-2xs ${
                        !isOwner
                          ? 'bg-blue-50 text-blue-700 border border-blue-300'
                          : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      }`}
                    >
                      <Target className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-800">No matching goals found</h3>
                    <p className="text-slate-600 font-medium text-sm max-w-sm mx-auto mt-1 mb-5">
                      {searchQuery
                        ? 'Try clearing your search query or create a new goal.'
                        : isOwner
                        ? 'Create your first goal to begin breaking down your roadmap.'
                        : 'This client has no goals yet.'}
                    </p>
                    {isOwner && (
                      <button
                        onClick={() => setIsModalOpen(true)}
                        data-plain
                        className="btn-tone text-sm px-5 py-2.5 flex items-center gap-2 mx-auto"
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                        <span>Create Your First Goal</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-5">
                    {filteredGoals.map((goal) => (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        today={todayDate}
                        isOwner={isOwner}
                        canEdit={goalAccessLevel(goal.id) === 'edit'}
                        professionalRole={professionalRole}
                        collaborators={isOwner ? profile?.collaborators || [] : []}
                        onOpen={(date) => openGoal(goal.id, date)}
                        onManageAccess={() => setManagingAssignedGoal(goal)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VIEW 2: TODAY'S MASTER FOCUS */}
            {activeTab === 'today' && (
              <div className="space-y-6">
                {/* Header: the mascot, the date and one calm progress line */}
                <div className="rise flex items-center gap-4">
                  <Orb size={64} float className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="section-label">{formatFullMonth(curMonthKey)}</span>
                    <h1 className="page-title">{formatDisplayDate(todayDate)}</h1>
                    <p className="page-lede">
                      {allTodayTasks.length === 0
                        ? 'Nothing planned yet. A calm day.'
                        : allTodayTasks.every((t) => t.completed)
                        ? 'All done for today. Nicely done!'
                        : `${allTodayTasks.filter((t) => t.completed).length} of ${allTodayTasks.length} done. Keep going.`}
                    </p>
                  </div>
                </div>
                {allTodayTasks.length > 0 && (
                  <ProgressBar
                    value={Math.round(
                      (allTodayTasks.filter((t) => t.completed).length / allTodayTasks.length) * 100
                    )}
                    height="h-2.5"
                  />
                )}

                {/* Card from the admin, under the progress bar */}
                <CmsBanners banners={liveBanners} placement="today-card" limit={1} />

                {/* Goals Work Breakdown for Today */}
                {goals.length === 0 ? (
                  <div className="rise neu rounded-3xl p-12 text-center font-medium text-slate-600 text-sm">
                    No active goals yet. Create a goal to start planning your daily tasks.
                  </div>
                ) : allTodayTasks.length === 0 ? (
                  <div className="rise neu rounded-3xl p-10 text-center space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-2xs">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-800">No Tasks Scheduled for Today</h3>
                      <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                        Select a goal below to jump in and plan your subcategories or tasks for today ({formatDisplayDate(todayDate)}).
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      {goals.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => {
                            setSelectedGoalId(g.id);
                            setActiveTab('detail');
                          }}
                          className="chip flex items-center gap-1.5 px-3.5 py-2 text-xs"
                        >
                          <ArrowRight className="w-3 h-3 text-emerald-600" />
                          <span>{g.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {goals.map((g) => {
                      const goalTodayTasks = (g.tasks || []).filter((t) => t.date === todayDate);
                      const canManageGoal = canEditGoal(g.id);
                      const completedCount = goalTodayTasks.filter((t) => t.completed).length;
                      const goalSubcategories = (g.subcategories || []).filter((s) => {
                        if (s.date) return s.date === todayDate;
                        return goalTodayTasks.some((t) => t.subcategoryId === s.id);
                      });

                      const uncategorized = goalTodayTasks.filter((t) => !t.subcategoryId);

                      // If no tasks or subcategories for today yet, show a clean quick-start card if authorized
                      if (goalTodayTasks.length === 0 && goalSubcategories.length === 0) {
                        return null;
                      }

                      return (
                        <div
                          key={g.id}
                          className="rise neu rounded-2xl p-4 sm:p-5 space-y-4"
                        >
                          {/* Goal Header */}
                          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 flex-wrap">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <span className="badge shrink-0">
                                {g.category || 'General'}
                              </span>
                              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight break-words">
                                {g.title}
                              </h2>
                            </div>

                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="text-xs font-bold text-slate-600 tabular-nums">
                                {completedCount}/{goalTodayTasks.length} Done
                              </span>
                              <button
                                onClick={() => {
                                  setSelectedGoalId(g.id);
                                  setActiveTab('detail');
                                }}
                                className="neu-sm press flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-emerald-800 cursor-pointer"
                              >
                                <span>View Roadmap</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* The same block the goal page uses, so a task looks and behaves the
                              same everywhere. Today is for doing: tick tasks and add more, while
                              renaming and deleting stay on the goal page. */}
                          <div className="space-y-3">
                            {uncategorized.length > 0 && (
                              <SubcategoryBlock
                                name="General tasks"
                                expanded={!todayCollapsed['__general__']}
                                onToggle={() => toggleTodayBlock('__general__')}
                                tasks={uncategorized}
                                goal={g}
                                canEditTasks={canManageGoal}
                                canManage={false}
                                onToggleTask={(taskId) => handleToggleTask(g.id, taskId)}
                              />
                            )}

                            {goalSubcategories.map((sub) => {
                              const canEditSub = canEditSubcategoryTasks(g.id, sub);
                              return (
                                <SubcategoryBlock
                                  key={sub.id}
                                  name={sub.name}
                                  expanded={!todayCollapsed[sub.id]}
                                  onToggle={() => toggleTodayBlock(sub.id)}
                                  tasks={goalTodayTasks.filter((t) => t.subcategoryId === sub.id)}
                                  goal={g}
                                  sub={sub}
                                  canEditTasks={canEditSub}
                                  canManage={false}
                                  onAddTask={
                                    canEditSub
                                      ? (text, priority, forward) =>
                                          handleAddTask(g.id, text, priority, sub.id, todayDate, forward)
                                      : undefined
                                  }
                                  onToggleTask={canEditSub ? (taskId) => handleToggleTask(g.id, taskId) : undefined}
                                />
                              );
                            })}

                            {/* Quick add: a subcategory for today, without leaving this page */}
                            {canManageGoal &&
                              (todayAddingSubGoalId === g.id ? (
                                <form
                                  onSubmit={async (e) => {
                                    e.preventDefault();
                                    if (todayNewSubName.trim()) {
                                      await handleAddSubcategory(g.id, todayNewSubName.trim(), todayDate);
                                      setTodayNewSubName('');
                                      setTodayAddingSubGoalId(null);
                                    }
                                  }}
                                  className="neu-inset-sm p-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center"
                                >
                                  <input
                                    type="text"
                                    placeholder="New subcategory, e.g. Upper body, Lunch plan"
                                    value={todayNewSubName}
                                    onChange={(e) => setTodayNewSubName(e.target.value)}
                                    aria-label="New subcategory"
                                    className="flex-1 text-sm rounded-xl px-3.5 py-2.5"
                                    autoFocus
                                  />
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="submit"
                                      disabled={!todayNewSubName.trim()}
                                      className="btn-tone px-4 py-2.5 text-xs"
                                    >
                                      Create
                                    </button>
                                    <button
                                      type="button"
                                      className="chip px-3.5 py-2.5 text-xs"
                                      onClick={() => {
                                        setTodayAddingSubGoalId(null);
                                        setTodayNewSubName('');
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <button
                                  type="button"
                                  className="chip inline-flex items-center gap-1.5 px-3.5 py-2 text-xs"
                                  onClick={() => {
                                    setTodayAddingSubGoalId(g.id);
                                    setTodayNewSubName('');
                                  }}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Add subcategory for today</span>
                                </button>
                              ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* VIEW 3: GOAL DETAIL */}
            {activeTab === 'detail' && currentGoal && (
              <div className="space-y-6">
                {/* Top Goal Bar */}
                <div
                  className={`neu rounded-2xl p-4 sm:p-6 transition-colors duration-200 ${
                    !isOwner ? 'border-violet-200/90 shadow-violet-950/5' : 'border-violet-200/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {isEditingGoalHeader ? (
                        <div className="neu-inset p-4 space-y-3.5">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-800">Edit Goal Details</h3>
                            <button
                              type="button"
                              onClick={() => setIsEditingGoalHeader(false)}
                              data-plain
                              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Cancel</span>
                            </button>
                          </div>
                          <div>
                            <label className="section-label block mb-1.5">Goal title</label>
                            <input
                              type="text"
                              value={editGoalTitle}
                              onChange={(e) => setEditGoalTitle(e.target.value)}
                              className="w-full text-sm font-semibold rounded-xl px-3.5 py-2.5"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="section-label block mb-1.5">Category</label>
                              <input
                                type="text"
                                value={editGoalCategory}
                                onChange={(e) => setEditGoalCategory(e.target.value)}
                                className="w-full text-sm rounded-xl px-3.5 py-2.5"
                              />
                            </div>
                            <div>
                              <label className="section-label block mb-1.5">Description</label>
                              <input
                                type="text"
                                value={editGoalDesc}
                                onChange={(e) => setEditGoalDesc(e.target.value)}
                                className="w-full text-sm rounded-xl px-3.5 py-2.5"
                                placeholder="Goal description..."
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!editGoalTitle.trim()) return;
                                await handleUpdateGoalDetails(currentGoal.id, {
                                  title: editGoalTitle.trim(),
                                  category: editGoalCategory.trim() || 'General',
                                  description: editGoalDesc.trim(),
                                });
                                setIsEditingGoalHeader(false);
                              }}
                              className="btn-tone px-4 py-2 text-xs"
                            >
                              Save Changes
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsEditingGoalHeader(false)}
                              className="chip px-3.5 py-2 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => {
                                setSelectedGoalId(null);
                                setActiveTab('dashboard');
                              }}
                              className="chip px-2.5 py-1 text-[11px]"
                            >
                              ← Back
                            </button>
                            <span className="badge">{currentGoal.category || 'General'}</span>
                            <span className="badge">{formatFullMonth(currentGoal.targetDate)}</span>
                          </div>
                          <h1 className="mt-1.5 text-xl sm:text-3xl font-bold text-slate-900">
                            {currentGoal.title}
                          </h1>
                          {currentGoal.description && (
                            <p className="text-slate-600 text-xs sm:text-sm mt-0.5 max-w-3xl leading-relaxed">
                              {currentGoal.description}
                            </p>
                          )}
                        </>
                      )}

                      {!isOwner && (
                        <span
                          className={`mt-2 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                            canEditGoal(currentGoal.id)
                              ? 'bg-blue-50 border-blue-200 text-blue-900'
                              : 'bg-slate-300/30 border-slate-300/40 text-slate-600'
                          }`}
                          title={
                            canEditGoal(currentGoal.id)
                              ? `You can edit this goal as ${professionalRole || 'Professional'}`
                              : 'Your client gave you view-only access to this goal'
                          }
                        >
                          <ShieldCheck className="w-3 h-3" />
                          {canEditGoal(currentGoal.id) ? 'Editing allowed' : 'View only'}
                        </span>
                      )}

                      {isOwner && profile?.collaborators && profile.collaborators.length > 0 && (
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap text-[11px]">
                          <span className="text-slate-400 font-medium">Assigned:</span>
                          {(() => {
                            const assigned = profile.collaborators.filter((c) =>
                              isGoalSharedWith(c, currentGoal.id)
                            );
                            if (assigned.length === 0) {
                              return <span className="text-slate-400 italic">None assigned</span>;
                            }
                            return assigned.map((c) => (
                              <span key={c.uid} className="badge">
                                <span>{c.name || c.email || 'Pro'}</span>
                                <span className="font-normal opacity-80">({c.role})</span>
                              </span>
                            ));
                          })()}
                          <button
                            type="button"
                            onClick={() => setManagingAssignedGoal(currentGoal)}
                            className="chip flex items-center gap-1 px-2.5 py-1 text-[11px]"
                          >
                            <Settings className="w-3 h-3" />
                            <span>Manage Access</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Secondary actions live here, small and out of the way. */}
                    {isOwner && !isEditingGoalHeader && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <GlassIconButton
                          variant="purple"
                          size="md"
                          title="Edit goal details"
                          onClick={() => {
                            setEditGoalTitle(currentGoal.title);
                            setEditGoalCategory(currentGoal.category || 'General');
                            setEditGoalDesc(currentGoal.description || '');
                            setIsEditingGoalHeader(true);
                          }}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </GlassIconButton>
                        <GlassIconButton
                          variant="rose"
                          size="md"
                          title="Give up on this goal"
                          onClick={() => setGiveUpTargetGoal(currentGoal)}
                        >
                          <Flag className="w-3.5 h-3.5" />
                        </GlassIconButton>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2-Column Responsive Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* LEFT: the editing flow (pick a day, plan it), the wider column */}
                  <div className="lg:col-span-7 space-y-6">
                    <DailyTaskSection
                      goal={currentGoal}
                      isOwner={isOwner}
                      canManageCategories={canEditGoal(currentGoal.id)}
                      selectedMonthKey={selectedGoalMonth}
                      initialDate={selectedGoalDate}
                      onSelectMonth={setSelectedGoalMonth}
                      canEditSubcategoryTasks={(sub) => canEditSubcategoryTasks(currentGoal.id, sub)}
                      onAddSubcategory={handleAddSubcategory}
                      onAddRepeatingSubcategory={handleAddRepeatingSubcategory}
                      onRenameSubcategory={handleRenameSubcategory}
                      onDeleteSubcategory={handleDeleteSubcategory}
                      onSetSubcategoryRole={handleSetSubcategoryRole}
                      onChangeSubcategoryRepeat={handleChangeSubcategoryRepeat}
                      onAddTask={handleAddTask}
                      onUpdateTask={handleUpdateTask}
                      onToggleTask={handleToggleTask}
                      onDeleteTask={handleDeleteTask}
                    />
                  </div>

                  {/* RIGHT: the roadmap */}
                  <div className="lg:col-span-5 space-y-6">
                    <MonthlyMilestoneSection
                      goal={currentGoal}
                      isOwner={isOwner}
                      readOnly={!canEditGoal(currentGoal.id)}
                      selectedMonthKey={selectedGoalMonth}
                      onSelectMonth={setSelectedGoalMonth}
                      onToggleMilestone={handleToggleMilestone}
                      onUpdateMilestoneTitle={handleUpdateMilestoneTitle}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'professional' && isOwner && (
              profile?.persona === 'professional' ? (
                <ProfessionalProfilePanel
                  user={user}
                  profile={profile}
                  onError={setErrorMessage}
                  switching={savingPersona}
                  onSwitchToClient={handleLeaveProfessional}
                />
              ) : (
                <AccountProfilePanel
                  user={user}
                  profile={profile}
                  saving={savingPersona}
                  onBecomeProfessional={() => handleChoosePersona('professional')}
                />
              )
            )}

            {activeTab === 'connect' && (
              <CollaboratorsPanel
                user={user}
                profile={profile}
                incomingRequests={incomingRequests}
                incomingError={incomingError}
                outgoingRequests={outgoingRequests}
                clientList={visibleClients}
                connectNotice={connectNotice}
                workspaceUid={workspaceUid}
                goals={goals}
                onRequestAccess={handleRequestAccess}
                onApprove={handleApproveRequest}
                onDeny={handleDenyRequest}
                onRemove={handleRemoveCollaborator}
                onUpdateAssignedGoals={handleUpdateAssignedGoals}
                onSwitchWorkspace={handleSwitchWorkspace}
                onRemoveClient={handleRemoveClient}
                onOpenChat={setChatTarget}
                unreadChatUids={unreadChatUids}
              />
            )}
          </div>
      </main>

      {chatTarget && user && (
        <ChatPanel
          me={{ uid: user.uid, name: profile?.displayName || user.displayName || user.email || 'You' }}
          other={chatTarget}
          onClose={() => setChatTarget(null)}
        />
      )}

      {/* FOOTER */}
      <footer className="neu border-x-0 border-b-0 rounded-none py-3.5 sm:py-6 mt-6 sm:mt-12">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-4 text-[11px] sm:text-xs text-slate-500 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span>Goal Path App</span>
            <span>•</span>
            <span>Firestore Cloud Sync Active</span>
          </div>
          {/* The address is the one thing here worth acting on, so it is a button
              that copies itself rather than a line of text. */}
          <button
            type="button"
            onClick={() => {
              if (!user.email) return;
              void navigator.clipboard?.writeText(user.email).catch(() => {});
              setCopiedEmail(true);
              window.setTimeout(() => setCopiedEmail(false), 2000);
            }}
            title="Copy your email address"
            className="neu-sm press flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold text-slate-700 cursor-pointer"
          >
            {copiedEmail ? (
              <Check className="w-3 h-3 text-emerald-700" />
            ) : (
              <Copy className="w-3 h-3 text-slate-500" />
            )}
            <span className="truncate max-w-[190px] text-slate-800 font-semibold">
              {copiedEmail ? 'Email copied' : user.email}
            </span>
          </button>
        </div>
      </footer>

      {/* The screens below are mounted only while open, so each opening starts clean.
          Left mounted, they kept the last step, answers or half-typed text after closing. */}

      {/* OPTIONAL "HELP ME PLAN" QUESTIONS. Opens over the form, so closing it returns to the form as it was. */}
      {guidedOpen && (
        <GuidedGoal
          initialNiche={guidedNiche}
          onClose={(goalId) => {
            setGuidedOpen(false);
            if (goalId) {
              setIsModalOpen(false);
              openGoal(goalId);
            }
          }}
          onCreate={handleCreateGuidedGoal}
        />
      )}

      {/* CREATE GOAL MODAL */}
      {isModalOpen && (
        <CreateGoalModal
          isOpen
          onHelpMeChoose={(category) => {
            setGuidedNiche(nicheForCategory(category));
            setGuidedOpen(true);
          }}
          onClose={() => setIsModalOpen(false)}
          collaborators={profile?.collaborators || []}
          onSave={handleCreateGoal}
        />
      )}

      {/* GOAL ASSIGNMENT MODAL */}
      {managingAssignedGoal && (
        <GoalAssignmentModal
          isOpen
          onClose={() => setManagingAssignedGoal(null)}
          goal={managingAssignedGoal}
          collaborators={profile?.collaborators || []}
          onSave={handleSaveGoalCollaboratorAssignments}
        />
      )}

      {/* GIVE UP MOTIVATIONAL INTERVENTION MODAL */}
      {giveUpTargetGoal && (
      <GiveUpInterventionModal
        isOpen
        onClose={() => setGiveUpTargetGoal(null)}
        goal={giveUpTargetGoal}
        onConfirmGiveUp={async () => {
          if (giveUpTargetGoal) {
            const idToDelete = giveUpTargetGoal.id;
            setGiveUpTargetGoal(null);
            await handleGiveUpGoal(idToDelete);
          }
        }}
        onExtendGoalDeadline={async (goalId, monthsToAdd) => {
          await handleExtendGoalDeadline(goalId, monthsToAdd);
        }}
      />
      )}

      {/* DOUBLE-BACK EXIT HINT: phone + laptop, above the tab bar */}
      {exitPromptVisible && (
        <div className="fixed bottom-20 sm:bottom-8 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg animate-in fade-in duration-150">
            Press back again to leave
          </div>
        </div>
      )}

      {/* PHONE TAB BAR: a floating bar that stays on screen while you scroll.
          The + sits dead-centre, flanked by two equal-width groups of tabs, so
          it stays centred whether there are three tabs (client) or four
          (professional). No sliding pill here — it would cross behind the + and
          read as passing through it — the active tab gets a static chip. */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-50 px-3 safe-bottom pointer-events-none">
        <div
          ref={phoneNav.ref}
          data-tone={!isOwner ? 'warm' : 'cool'}
          className="segmented mx-auto max-w-md pointer-events-auto shadow-lg relative z-50"
        >
          {/* One pill for the whole bar: it glides continuously from any tab to
              any tab. The + button is raised above it, so the pill slides
              smoothly underneath the + instead of jumping across the middle. */}
          <span
            className="segmented-track"
            aria-hidden="true"
            style={{
              transform: `translateX(${phoneNav.track.x}px)`,
              width: phoneNav.track.width,
              opacity: phoneNav.track.ready ? 1 : 0,
            }}
          />

          {isOwner ? (
            <>
              <div className="flex flex-1 items-stretch gap-1">
                {navTabs.slice(0, Math.ceil(navTabs.length / 2)).map(renderNavButton)}
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                aria-label="New Goal"
                title="New Goal"
                data-plain
                className="btn-tone press relative z-20 -mt-6 w-12 h-12 shrink-0 ring-4 ring-white flex items-center justify-center"
              >
                <Plus className="w-5 h-5 stroke-[2.5]" />
              </button>

              <div className="flex flex-1 items-stretch gap-1">
                {navTabs.slice(Math.ceil(navTabs.length / 2)).map(renderNavButton)}
              </div>
            </>
          ) : (
            navTabs.map(renderNavButton)
          )}
        </div>
      </nav>

      {/* FIRST-RUN QUESTIONS: asked once for a new account, and again from the account menu */}
      {!!user && !!profile && !dataLoading && isOwner && personaPickerOpen && (
        <Onboarding
          isOpen
          name={((profile?.displayName || user.displayName || '').split(' ')[0] || '').trim()}
          onFinish={handleFinishOnboarding}
          onClose={handleCloseOnboarding}
        />
      )}
    </div>
  );
}
