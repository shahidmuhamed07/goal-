/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  User,
  signInWithPopup,
  signInWithRedirect,
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
  Lock,
  ShieldCheck,
  LogOut,
  Search,
  Users,
  Settings,
  Flag,
  X,
  ArrowRight,
  Sparkles,
  Briefcase,
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
} from './utils';

import { LoginScreen } from './components/LoginScreen';
import { AppSelect } from './components/AppSelect';
import { PriorityBadge, ProgressBar, GoalPathLogo, GlassIconButton, GlassBadge } from './components/UIElements';
import { DailyTaskSection } from './components/DailyTaskSection';
import { MonthlyMilestoneSection } from './components/MonthlyMilestoneSection';
import { CollaboratorsPanel } from './components/CollaboratorsPanel';
import { CreateGoalModal } from './components/CreateGoalModal';
import { GoalAssignmentModal } from './components/GoalAssignmentModal';
import { GiveUpInterventionModal } from './components/GiveUpInterventionModal';
import { ProfessionalProfilePanel } from './components/ProfessionalProfilePanel';
import { PersonaPrompt } from './components/PersonaPrompt';
import goalPathHero from './assets/images/goal_path_hero_1787491145015.jpg';

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

  // Data State
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [giveUpTargetGoal, setGiveUpTargetGoal] = useState<Goal | null>(null);

  // UI View State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'today' | 'detail' | 'connect' | 'professional'>('dashboard');
  const [savingPersona, setSavingPersona] = useState(false);
  const [personaPromptDismissed, setPersonaPromptDismissed] = useState(false);
  const [personaPickerOpen, setPersonaPickerOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [dailyMasterDate, setDailyMasterDate] = useState<string>(getTodayDateString());
  const [selectedGoalMonth, setSelectedGoalMonth] = useState<string>(getCurrentMonthKey());
  const [managingAssignedGoal, setManagingAssignedGoal] = useState<Goal | null>(null);

  // Today's Focus inline editing and creation state
  const [todayEditingTaskId, setTodayEditingTaskId] = useState<string | null>(null);
  const [todayEditTaskText, setTodayEditTaskText] = useState('');
  const [todayEditTaskPriority, setTodayEditTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [todayAddingTaskSubId, setTodayAddingTaskSubId] = useState<string | null>(null);
  const [todayNewTaskText, setTodayNewTaskText] = useState('');
  const [todayNewTaskPriority, setTodayNewTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
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

  // Realtime client list & active client profile listener
  const [activeClientProfile, setActiveClientProfile] = useState<UserProfile | null>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

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
    if (isOwner && profile?.persona === 'professional') tabs.push('professional');
    return tabs;
  }, [isOwner, profile?.persona]);

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

  /** Slides the current view out, swaps the tab, then slides the new one in. */
  const commitSwipe = (step: number) => {
    const target = swipeTarget(step);
    if (!target || swipe.current.locked) return;
    swipe.current.locked = true;
    const element = contentRef.current;
    if (element) element.style.willChange = 'transform, opacity';

    paintContent(step === 1 ? -64 : 64, 0.3, 'transform 130ms ease-in, opacity 130ms ease-in');
    window.setTimeout(() => {
      setSelectedGoalId(null);
      setActiveTab(target);
      paintContent(step === 1 ? 64 : -64, 0.3, 'none');
      window.requestAnimationFrame(() => settleContent());
    }, 140);
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
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const authErr = err as { code?: string; message?: string };
      console.error('Google Sign In Error:', err);
      if (
        authErr.code === 'auth/popup-blocked' ||
        authErr.code === 'auth/cancelled-popup-request' ||
        authErr.code === 'auth/popup-closed-by-user'
      ) {
        setAuthError('Popup was blocked. Redirecting to Google sign-in...');
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectErr: unknown) {
          const rErr = redirectErr as { message?: string };
          console.error('Google redirect sign-in error:', redirectErr);
          setAuthError(rErr.message || 'Google sign-in failed. Please allow popups or try again.');
        }
        return;
      }
      setAuthError(authErr.message || 'Failed to sign in with Google. Please try again.');
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

  const handleRenameSubcategory = async (goalId: string, subcategoryId: string, name: string) => {
    if (!canEditGoal(goalId)) return;
    const targetGoal = goals.find((g) => g.id === goalId);
    if (!targetGoal) return;

    const updatedSubcategories = (targetGoal.subcategories || []).map((s) =>
      s.id === subcategoryId ? { ...s, name } : s
    );

    try {
      await updateDoc(doc(db, 'goals', goalId), {
        subcategories: updatedSubcategories,
      });
    } catch (err) {
      console.error('Rename subcategory error:', err);
      setErrorMessage('Failed to rename sub-category.');
    }
  };

  const handleDeleteSubcategory = async (goalId: string, subcategoryId: string) => {
    if (!canEditGoal(goalId)) return;

    const targetGoal = goals.find((g) => g.id === goalId);
    if (!targetGoal) return;

    const updatedSubcategories = (targetGoal.subcategories || []).filter(
      (s) => s.id !== subcategoryId
    );
    const updatedTasks = (targetGoal.tasks || []).filter((t) => t.subcategoryId !== subcategoryId);

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

    const updatedSubcategories = (targetGoal.subcategories || []).map((s) =>
      s.id === subcategoryId ? { ...s, editorRole: editorRole || null } : s
    );

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
    date?: string
  ) => {
    const targetGoal = goals.find((g) => g.id === goalId);
    if (!targetGoal) return;

    if (!canEditGoal(goalId)) return;

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

  // LOADING & LOGIN GATES
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-semibold text-slate-500">Checking authentication...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginScreen
        onLogin={handleGoogleSignIn}
        loading={authLoading}
        error={authError}
      />
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-300 ${
        !isOwner
          ? 'bg-[#f4f8ff] selection:bg-blue-200 selection:text-blue-950'
          : 'bg-slate-50/90 selection:bg-emerald-100 selection:text-emerald-900'
      } text-slate-900 relative overflow-x-hidden`}
    >
      {/* Ambient background wash, cool blue while a professional works in a client's workspace */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        {/* Delicate geometric micro-dot grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
        {/* Soft, low-contrast ambient color washes */}
        <div
          className={`absolute -top-32 right-1/4 w-[500px] h-[500px] rounded-full blur-3xl transition-all duration-700 ${
            !isOwner ? 'bg-blue-200/40' : 'bg-emerald-100/35'
          }`}
        />
        <div
          className={`absolute top-1/2 -left-32 w-[450px] h-[450px] rounded-full blur-3xl transition-all duration-700 ${
            !isOwner ? 'bg-sky-200/30' : 'bg-teal-100/25'
          }`}
        />
        <div
          className={`absolute bottom-10 right-10 w-[400px] h-[400px] rounded-full blur-3xl transition-all duration-700 ${
            !isOwner ? 'bg-blue-100/40' : 'bg-slate-200/40'
          }`}
        />
      </div>

      {/* DISTINCT TRAINER MODE COMMAND BAR AT THE VERY TOP - REFINED SOFT WARM blue / CLAY THEME */}
      {!isOwner && workspaceProfile && (
        <div className="bg-blue-50/95 text-blue-950 border-b border-blue-200/90 px-2.5 sm:px-6 py-1.5 sm:py-2 min-h-[40px] sm:min-h-[44px] flex items-center justify-between gap-2 sm:gap-3 shadow-xs sticky top-0 z-40 backdrop-blur-md">
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
        } z-30 shadow-xs transition-colors duration-200 ${
          !isOwner
            ? 'bg-white/95 border-b border-blue-200/90 backdrop-blur-md'
            : 'bg-white border-b border-slate-200'
        }`}
      >
        <div className="max-w-6xl mx-auto px-2.5 sm:px-6 h-12 sm:h-16 flex items-center justify-between gap-2 sm:gap-3">
          {/* Logo / Brand with GoalPath vector integrated */}
          <div
            onClick={() => {
              setSelectedGoalId(null);
              setActiveTab('dashboard');
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
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 sm:p-1 rounded-xl text-xs font-semibold min-w-0 shrink">
                <span className="text-[10px] text-slate-400 uppercase font-bold pl-1 hidden md:inline">
                  Workspace:
                </span>
                <AppSelect
                  value={workspaceUid || user.uid}
                  onChange={handleSwitchWorkspace}
                  ariaLabel="Switch workspace"
                  className="bg-white border border-slate-200 rounded-lg px-1.5 py-0.5 sm:px-2 sm:py-1 text-slate-800 text-[10.5px] sm:text-xs font-bold hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full min-w-0 max-w-[118px] sm:max-w-[180px]"
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

            {/* Create Goal Button for Owner */}
            {isOwner && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                aria-label="New Goal"
                className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs sm:text-sm px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
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
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-lg p-3 z-50 space-y-2">
                    <div className="pb-2 border-b border-slate-100">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {user.displayName || 'Goal Path User'}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
                      {!isOwner && (
                        <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded mt-1.5 inline-block">
                          Active Role: {professionalRole || 'Trainer'}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        if (profile?.persona === 'professional') {
                          setActiveTab('professional');
                        } else {
                          setPersonaPickerOpen(true);
                        }
                      }}
                      className="w-full text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 px-2.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer"
                    >
                      <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                      <span>
                        {profile?.persona === 'professional'
                          ? 'My professional profile'
                          : 'Add a professional profile'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        handleSignOut();
                      }}
                      className="w-full text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 px-2.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer"
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

      {/* VIEW SWITCHER TABS BAR */}
      <div
        className={`border-b py-1.5 sm:py-2 px-2.5 sm:px-6 transition-colors duration-200 ${
          !isOwner
            ? 'bg-blue-50/60 border-blue-200/80'
            : 'bg-slate-50 border-slate-200/90'
        }`}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
          <nav
            className={`flex items-center p-0.5 sm:p-1 rounded-xl gap-0.5 sm:gap-1 text-[11px] sm:text-xs font-semibold overflow-x-auto max-w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
              !isOwner ? 'bg-blue-100/70' : 'bg-slate-200/70'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setSelectedGoalId(null);
                setActiveTab('dashboard');
              }}
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
                activeTab === 'dashboard'
                  ? !isOwner
                    ? 'bg-blue-700 text-white shadow-xs font-bold'
                    : 'bg-white text-slate-900 shadow-xs font-bold'
                  : !isOwner
                  ? 'text-blue-950/80 hover:text-blue-950'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="hidden sm:inline">All Goals ({goals.length})</span>
              <span className="sm:hidden">Goals ({goals.length})</span>
            </button>

            {/* TODAY'S FOCUS WITH OPTICALLY CENTERED CIRCLE */}
            <button
              type="button"
              onClick={() => setActiveTab('today')}
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg transition flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'today'
                  ? !isOwner
                    ? 'bg-blue-700 text-white shadow-xs font-bold'
                    : 'bg-white text-slate-900 shadow-xs font-bold'
                  : !isOwner
                  ? 'text-blue-950/80 hover:text-blue-950'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="hidden sm:inline">Today's Focus</span>
              <span className="sm:hidden">Today</span>
              <span
                className={`inline-flex items-center justify-center min-w-[17px] h-[17px] sm:min-w-[20px] sm:h-[20px] px-1 text-[10px] sm:text-[11px] font-bold rounded-full leading-none shadow-2xs shrink-0 ${
                  !isOwner
                    ? 'bg-blue-200 text-blue-950'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {allTodayTasks.filter((t) => !t.completed).length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('connect')}
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg transition flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'connect'
                  ? !isOwner
                    ? 'bg-blue-700 text-white shadow-xs font-bold'
                    : 'bg-white text-slate-900 shadow-xs font-bold'
                  : !isOwner
                  ? 'text-blue-950/80 hover:text-blue-950'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="hidden sm:inline">Collaborate</span>
              <span className="sm:hidden">Connect</span>
              {pendingIncoming.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[17px] h-[17px] sm:min-w-[18px] sm:h-[18px] px-1 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 leading-none shadow-2xs shrink-0">
                  {pendingIncoming.length}
                </span>
              )}
            </button>

            {/* Only professionals see their own profile tab, and only in their own workspace */}
            {isOwner && profile?.persona === 'professional' && (
              <button
                type="button"
                onClick={() => setActiveTab('professional')}
                className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg transition flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'professional'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5 hidden sm:block" />
                <span className="hidden sm:inline">Professional</span>
                <span className="sm:hidden">Profile</span>
              </button>
            )}
          </nav>

        </div>
      </div>

      {/* MAIN CONTAINER */}
      <main
        ref={contentRef}
        className="max-w-6xl mx-auto px-3 sm:px-6 py-5 sm:py-8 flex-1 w-full relative z-10"
      >
        {dataLoading && activeTab !== 'connect' && activeTab !== 'professional' ? (
          <div className="text-center py-20">
            <div
              className={`w-8 h-8 border-2 ${
                !isOwner ? 'border-blue-600' : 'border-emerald-600'
              } border-t-transparent rounded-full animate-spin mx-auto mb-3`}
            ></div>
            <span className="text-xs font-semibold text-slate-400">Loading goals from cloud...</span>
          </div>
        ) : (
          <>
            {/* VIEW 1: ALL GOALS DASHBOARD */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* Dashboard Metrics Hero Banner - Frosted Glass Window */}
                <div
                  className={`relative overflow-hidden rounded-3xl p-4 sm:p-8 shadow-2xl text-white transition-all duration-300 border border-purple-200/50 ring-1 ring-purple-100/40 bg-slate-950/40 backdrop-blur-2xl group ${
                    !isOwner
                      ? 'shadow-purple-950/20'
                      : 'shadow-slate-950/20'
                  }`}
                >
                  {/* Filling Hero Background Image visible through glass */}
                  <img
                    src={goalPathHero}
                    alt="Goal Path Horizon"
                    className="absolute inset-0 w-full h-full object-cover object-center opacity-65 select-none pointer-events-none scale-100 group-hover:scale-105 transition-transform duration-700 ease-out"
                    referrerPolicy="no-referrer"
                  />
                  {/* Frosted Glass Overlay with subtle light-purple specular shimmer */}
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-slate-950/80 via-slate-900/55 to-purple-950/45 backdrop-blur-xs" />
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/15 via-transparent to-purple-900/20" />

                  {/* Content Container */}
                  <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="max-w-xl">
                      {!isOwner && workspaceProfile ? (
                        <>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-200 bg-purple-900/80 border border-purple-400/50 px-2.5 py-0.5 rounded-md shadow-2xs">
                              Trainer Command Console
                            </span>
                          </div>
                          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-xs">
                            Managing {workspaceProfile.displayName || 'Client'}'s Program
                          </h1>
                          <p className="text-purple-100/90 text-xs sm:text-sm mt-1.5 leading-relaxed drop-shadow-2xs">
                            You are in client workspace mode. Design routine subcategories, configure daily tasks, and schedule milestones. All changes sync directly to {workspaceProfile.displayName || 'your client'}'s timeline.
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-950/80 border border-emerald-400/40 px-2.5 py-0.5 rounded-md shadow-2xs">
                              Cloud Synced Roadmap
                            </span>
                            <span className="text-xs text-slate-200">
                              Horizon &amp; Daily Action
                            </span>
                          </div>
                          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-xs">
                            Transform Vision Into Milestones
                          </h1>
                          <p className="text-slate-200 text-xs sm:text-sm mt-1.5 leading-relaxed drop-shadow-2xs">
                            Signed in as <span className="font-semibold text-white">{user.displayName || user.email}</span>. Break long-term ambition down into actionable monthly milestones and daily wins.
                          </p>

                          <div className="mt-3.5 flex items-center gap-2.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setIsModalOpen(true)}
                              className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 active:bg-white/40 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-xl border border-white/35 hover:border-purple-300/80 backdrop-blur-md transition shadow-md cursor-pointer active:scale-95"
                            >
                              <Plus className="w-4 h-4 text-emerald-300" />
                              <span>Create New Goal Path</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Highly Readable & Clickable Glassy Stat Cards */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3.5 flex-shrink-0">
                      {/* Stat 1: Goals */}
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById('goals-grid');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="backdrop-blur-xl bg-white/15 hover:bg-white/25 active:bg-white/30 border border-white/25 hover:border-purple-300/80 ring-1 ring-white/15 rounded-2xl p-3 sm:px-4 sm:py-3.5 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 group/card select-none text-center sm:text-left"
                        title="Click to view all goals"
                      >
                        <div className="text-xl sm:text-2xl font-black text-white">{goals.length}</div>
                        <div className={`text-[11px] font-medium ${!isOwner ? 'text-purple-200' : 'text-slate-200'}`}>
                          {!isOwner ? 'Client Goals' : 'Active Goals'}
                        </div>
                        <div className="text-[9px] font-semibold text-purple-200/80 group-hover/card:text-white flex items-center justify-center sm:justify-start gap-0.5 mt-1 transition">
                          <span>View Grid</span>
                          <ArrowRight className="w-2.5 h-2.5 group-hover/card:translate-x-0.5 transition-transform" />
                        </div>
                      </button>

                      {/* Stat 2: Tasks Today */}
                      <button
                        type="button"
                        onClick={() => setActiveTab('today')}
                        className="backdrop-blur-xl bg-white/15 hover:bg-white/25 active:bg-white/30 border border-white/25 hover:border-purple-300/80 ring-1 ring-white/15 rounded-2xl p-3 sm:px-4 sm:py-3.5 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 group/card select-none text-center sm:text-left"
                        title="Click to switch to Today's Focus"
                      >
                        <div className="text-xl sm:text-2xl font-black text-emerald-300">
                          {allTodayTasks.filter((t) => t.completed).length}/{allTodayTasks.length}
                        </div>
                        <div className={`text-[11px] font-medium ${!isOwner ? 'text-purple-200' : 'text-slate-200'}`}>
                          Tasks Today
                        </div>
                        <div className="text-[9px] font-semibold text-purple-200/80 group-hover/card:text-white flex items-center justify-center sm:justify-start gap-0.5 mt-1 transition">
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
                        className="backdrop-blur-xl bg-white/15 hover:bg-white/25 active:bg-white/30 border border-white/25 hover:border-purple-300/80 ring-1 ring-white/15 rounded-2xl p-3 sm:px-4 sm:py-3.5 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 group/card select-none text-center sm:text-left"
                        title="Click to view progress roadmap"
                      >
                        <div className="text-xl sm:text-2xl font-black text-white">{overallProgress}%</div>
                        <div className={`text-[11px] font-medium ${!isOwner ? 'text-purple-200' : 'text-slate-200'}`}>
                          Progress
                        </div>
                        <div className="text-[9px] font-semibold text-purple-200/80 group-hover/card:text-white flex items-center justify-center sm:justify-start gap-0.5 mt-1 transition">
                          <span>Roadmap</span>
                          <ArrowRight className="w-2.5 h-2.5 group-hover/card:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Client Workspaces You Support (Shown if you are a professional connected to clients) */}
                {isOwner && visibleClients.length > 0 && (
                  <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-800 space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/90 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                            Professional Access
                          </span>
                          <span className="text-xs text-slate-300">
                            {visibleClients.length} Connected Client{visibleClients.length > 1 ? 's' : ''}
                          </span>
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-white mt-1">
                          Client Workspaces You Support
                        </h3>
                        <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                          You are approved as a professional for the following clients. Switch to their workspace to design routines, add subcategories, and manage daily task plans.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
                      {visibleClients.map((client) => {
                        const collab = (client.collaborators || []).find((c) => c.uid === user.uid);
                        // Goals are shared through the client's own records, so the
                        // count has to come from every goal shared with this
                        // professional rather than from the open workspace.
                        const assignedCount = sharedGoals.filter(
                          (g) => g.userId === client.id
                        ).length;

                        return (
                          <div
                            key={client.id}
                            className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500/50 rounded-xl p-4 transition flex flex-col justify-between space-y-3 shadow-2xs"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-bold text-white truncate">
                                  {client.displayName || client.email || 'Client'}
                                </span>
                                <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                                  Client
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                {client.email}
                              </p>
                              {(formatJoinedDate(client.createdAt) || formatJoinedDate(collab?.addedAt)) && (
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  {formatJoinedDate(client.createdAt)
                                    ? `Joined ${formatJoinedDate(client.createdAt)}`
                                    : `Connected ${formatJoinedDate(collab?.addedAt)}`}
                                </p>
                              )}
                              <div className="text-xs text-slate-300 mt-2.5 flex items-center gap-1.5 font-medium">
                                <Target className="w-3.5 h-3.5 text-emerald-400" />
                                <span>
                                  {assignedCount === 'All'
                                    ? 'All Goals Assigned'
                                    : `${assignedCount} Assigned Session(s)`}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSwitchWorkspace(client.id || '')}
                              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2 px-3 rounded-lg shadow-2xs transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                            >
                              <span>Open Roadmap & Edit Subcategories</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Professional next-steps guide, shown only inside a client's workspace */}
                {!isOwner && workspaceProfile && (
                  <div className="bg-gradient-to-r from-blue-600/10 via-sky-600/5 to-blue-600/10 border border-blue-300/90 rounded-2xl p-4 sm:p-5 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-950 bg-blue-100 px-2.5 py-0.5 rounded-md flex items-center gap-1 border border-blue-300">
                          <Sparkles className="w-3 h-3 text-blue-700" />
                          <span>Trainer Next Steps</span>
                        </span>
                        <span className="text-xs font-bold text-blue-950">
                          Managing {workspaceProfile.displayName || 'Client'}'s Program
                        </span>
                      </div>
                      <span className="text-[11px] text-blue-900 font-bold bg-white px-2 py-0.5 rounded border border-blue-200">
                        Role: {professionalRole || 'Trainer'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="bg-white/95 border border-blue-200/80 rounded-xl p-3 shadow-2xs">
                        <div className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                          1 • Select a Goal
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          Click any client goal card below to view their monthly horizon and daily routine.
                        </p>
                      </div>

                      <div className="bg-white/95 border border-blue-200/80 rounded-xl p-3 shadow-2xs">
                        <div className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                          2 • Contextual Presets
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          Pick tailored routine presets (e.g. Budget & Accounts for Finance, Drills for Sports) or create custom subcategories.
                        </p>
                      </div>

                      <div className="bg-white/95 border border-blue-200/80 rounded-xl p-3 shadow-2xs">
                        <div className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                          3 • Configure & Schedule
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          Assign tasks, add target quantities, and track their monthly milestone progress.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Filter and Search Bar */}
                <div id="goals-grid" className="flex flex-col sm:flex-row items-center justify-between gap-3 scroll-mt-24">
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-2.5 text-slate-400 w-3.5 h-3.5" />
                    <input
                      type="text"
                      placeholder="Search goals or descriptions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full text-xs bg-white border rounded-xl pl-8 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none ${
                        !isOwner
                          ? 'border-purple-200 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600'
                          : 'border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600'
                      }`}
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1">
                    <span className="text-xs text-slate-400 font-medium flex-shrink-0">Category:</span>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`text-xs px-3 py-1 rounded-full font-medium capitalize whitespace-nowrap transition cursor-pointer ${
                          selectedCategory === cat
                            ? !isOwner
                              ? 'bg-purple-800 text-white shadow-2xs'
                              : 'bg-slate-900 text-white'
                            : !isOwner
                            ? 'bg-white text-purple-900/80 border border-purple-200 hover:bg-purple-50'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Goals Grid */}
                {filteredGoals.length === 0 ? (
                  <div className="text-center bg-white border border-slate-200 rounded-2xl p-12">
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
                    <p className="text-slate-400 text-sm max-w-sm mx-auto mt-1 mb-5">
                      {searchQuery
                        ? 'Try clearing your search query or create a new goal.'
                        : isOwner
                        ? 'Create your first goal to begin breaking down your roadmap.'
                        : 'This client has no goals yet.'}
                    </p>
                    {isOwner && (
                      <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm transition flex items-center gap-2 mx-auto cursor-pointer"
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                        <span>Create Your First Goal</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredGoals.map((goal) => {
                      const totalM = goal.milestones ? goal.milestones.length : 0;
                      const doneM = goal.milestones ? goal.milestones.filter((m) => m.completed).length : 0;
                      const pct = totalM > 0 ? Math.round((doneM / totalM) * 100) : 0;
                      const curKey = getCurrentMonthKey();
                      const curMilestone =
                        (goal.milestones && goal.milestones.find((m) => m.monthKey === curKey)) ||
                        (goal.milestones && goal.milestones.find((m) => !m.completed)) ||
                        (goal.milestones && goal.milestones[goal.milestones.length - 1]);

                      const goalTodayTasks = (goal.tasks || []).filter((t) => t.date === todayDate);
                      const doneTodayTasks = goalTodayTasks.filter((t) => t.completed).length;
                      const goalLevel = goalAccessLevel(goal.id);
                      const canEditThisGoal = goalLevel === 'edit';

                      return (
                        <div
                          key={goal.id}
                          onClick={() => {
                            setSelectedGoalId(goal.id);
                            setSelectedGoalMonth(getCurrentMonthKey());
                            setActiveTab('detail');
                          }}
                          className={`group bg-white border rounded-2xl p-4 sm:p-5 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                            !isOwner
                              ? canEditThisGoal
                                ? 'border-blue-300 ring-2 ring-blue-500/20 shadow-2xs hover:border-blue-500'
                                : 'border-sky-200 hover:border-sky-400'
                              : 'border-slate-200/90 hover:border-emerald-500/40'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                                  !isOwner
                                    ? 'text-blue-950 bg-blue-100/90 border-blue-300'
                                    : 'text-emerald-700 bg-emerald-50 border-emerald-100'
                                }`}
                              >
                                {goal.category || 'General'}
                              </span>
                              <span className="text-xs font-medium text-slate-400">
                                Target: {formatMonthKey(goal.targetDate)}
                              </span>
                            </div>

                            <h3
                              className={`font-bold text-slate-900 text-base transition-colors line-clamp-1 mb-1 ${
                                !isOwner ? 'group-hover:text-blue-800' : 'group-hover:text-emerald-700'
                              }`}
                            >
                              {goal.title}
                            </h3>

                            {isOwner && profile?.collaborators && profile.collaborators.length > 0 && (
                              <div className="flex items-center justify-between gap-1 mb-2.5 pt-0.5">
                                {(() => {
                                  const assigned = profile.collaborators.filter((c) =>
                                    isGoalSharedWith(c, goal.id)
                                  );
                                  const isAssigned = assigned.length > 0;
                                  return (
                                    <>
                                      <span
                                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                                          isAssigned
                                            ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                                            : 'text-slate-500 bg-slate-100 border-slate-200'
                                        }`}
                                      >
                                        <Users className="w-3 h-3" />
                                        <span>{assigned.length}/{profile.collaborators.length} Pros</span>
                                      </span>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setManagingAssignedGoal(goal);
                                        }}
                                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border transition cursor-pointer flex items-center gap-1 shadow-2xs ${
                                          isAssigned
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800'
                                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                                        }`}
                                      >
                                        {isAssigned ? (
                                          <>
                                            <Check className="w-3 h-3 text-emerald-600" />
                                            <span>Assigned</span>
                                          </>
                                        ) : (
                                          <>
                                            <Plus className="w-3 h-3" />
                                            <span>Assign Pro</span>
                                          </>
                                        )}
                                      </button>
                                    </>
                                  );
                                })()}
                              </div>
                            )}

                            {!isOwner && (
                              <div className="mb-2.5">
                                {canEditThisGoal ? (
                                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-950 bg-blue-50 border border-blue-300 px-2.5 py-1 rounded-lg">
                                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                                    <span>Assigned Session ({professionalRole || 'Trainer'})</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-800 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-lg">
                                    <Lock className="w-3 h-3 text-sky-500" />
                                    <span>View only ({professionalRole || 'Professional'})</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {goal.description && (
                              <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed mb-4">
                                {goal.description}
                              </p>
                            )}

                            {/* Current milestone spotlight */}
                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-4">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                                <span>Current Horizon</span>
                                <span>{curMilestone ? formatMonthKey(curMilestone.monthKey) : ''}</span>
                              </div>
                              <div className="text-xs font-medium text-slate-800 flex items-start gap-2">
                                <span
                                  className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                                    curMilestone?.completed
                                      ? !isOwner ? 'bg-blue-600' : 'bg-emerald-500'
                                      : 'bg-blue-500'
                                  }`}
                                />
                                <span
                                  className={`truncate ${
                                    curMilestone?.completed ? 'line-through text-slate-400' : ''
                                  }`}
                                >
                                  {curMilestone ? curMilestone.title : 'No milestone'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-slate-100">
                            <div className="flex justify-between items-center text-xs font-medium">
                              <span className="text-slate-400">
                                Milestones ({doneM}/{totalM})
                              </span>
                              <span className="text-slate-800 font-semibold">{pct}%</span>
                            </div>
                            <ProgressBar value={pct} height="h-1.5" />

                            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                              <span>Today's Actions</span>
                              <span className="font-semibold text-slate-700">
                                {doneTodayTasks}/{goalTodayTasks.length} completed
                              </span>
                            </div>

                            {!isOwner && (
                              <div className="pt-1.5">
                                {canEditThisGoal ? (
                                  <div className="w-full bg-blue-50 text-blue-950 border border-blue-300 font-semibold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 group-hover:bg-blue-600 group-hover:text-white transition shadow-2xs">
                                    <Edit2 className="w-3.5 h-3.5" />
                                    <span>Edit Subcategories & Routines</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </div>
                                ) : (
                                  <div
                                    className="w-full bg-sky-50 text-sky-900 border border-sky-200 font-semibold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5"
                                    title="Your client gave you read-only access to this goal"
                                  >
                                    <Lock className="w-3.5 h-3.5" />
                                    <span>Read-only access</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* VIEW 2: TODAY'S MASTER FOCUS */}
            {activeTab === 'today' && (
              <div className="space-y-6">
                {/* Header Banner */}
                <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md">
                        Today's Action Focus
                      </span>
                      <span className="text-xs font-semibold text-slate-400">
                        {formatFullMonth(curMonthKey)}
                      </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                      {formatDisplayDate(todayDate)}
                    </h1>
                    <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                      Your complete task breakdown and subcategories for today across all goals.
                    </p>
                  </div>

                  <div className="flex items-center gap-4 bg-slate-50 border border-slate-200/80 px-5 py-3 rounded-2xl self-start sm:self-auto">
                    <div>
                      <div className="text-xs text-slate-400 font-medium">Today's Progress</div>
                      <div className="text-2xl font-black text-emerald-600">
                        {allTodayTasks.filter((t) => t.completed).length} / {allTodayTasks.length}
                      </div>
                    </div>
                    <div className="w-12">
                      <ProgressBar
                        value={
                          allTodayTasks.length > 0
                            ? Math.round(
                                (allTodayTasks.filter((t) => t.completed).length / allTodayTasks.length) * 100
                              )
                            : 0
                        }
                        height="h-2"
                      />
                    </div>
                  </div>
                </div>

                {/* Goals Work Breakdown for Today */}
                {goals.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400 text-sm">
                    No active goals yet. Create a goal to start planning your daily tasks.
                  </div>
                ) : allTodayTasks.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-4">
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
                          className="px-3.5 py-1.5 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 text-slate-700 hover:text-emerald-800 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5"
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
                          className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4"
                        >
                          {/* Goal Header */}
                          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 flex-shrink-0">
                                {g.category || 'General'}
                              </span>
                              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
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
                                className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 hover:underline cursor-pointer"
                              >
                                View Roadmap →
                              </button>
                            </div>
                          </div>

                          {/* Subcategories & Tasks for this goal today */}
                          <div className="space-y-3">
                            {goalSubcategories.map((sub) => {
                              const subTasks = goalTodayTasks.filter((t) => t.subcategoryId === sub.id);
                              const canEditSub = canEditSubcategoryTasks(g.id, sub);
                              const isAddingTask = todayAddingTaskSubId === sub.id;

                              return (
                                <div
                                  key={sub.id}
                                  className="bg-slate-50/60 border border-slate-200/80 rounded-xl p-3.5 space-y-2.5"
                                >
                                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span>{sub.name}</span>
                                      {sub.editorRole && (
                                        <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-semibold capitalize">
                                          {sub.editorRole}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-semibold text-slate-400 lowercase">
                                        {subTasks.filter((t) => t.completed).length}/{subTasks.length} done
                                      </span>
                                      {canEditSub && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (isAddingTask) {
                                              setTodayAddingTaskSubId(null);
                                              setTodayNewTaskText('');
                                            } else {
                                              setTodayAddingTaskSubId(sub.id);
                                              setTodayNewTaskText('');
                                            }
                                          }}
                                          className="text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded-md transition cursor-pointer"
                                        >
                                          {isAddingTask ? (
                                            <span className="flex items-center gap-1">
                                              <X className="w-3 h-3" />
                                              <span>Cancel</span>
                                            </span>
                                          ) : (
                                            <span className="flex items-center gap-1">
                                              <Plus className="w-3 h-3" />
                                              <span>Add Task</span>
                                            </span>
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Inline Add Task Form for Subcategory on Today's Tab */}
                                  {isAddingTask && canEditSub && (
                                    <form
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        if (todayNewTaskText.trim()) {
                                          handleAddTask(
                                            g.id,
                                            todayNewTaskText.trim(),
                                            todayNewTaskPriority,
                                            sub.id,
                                            todayDate
                                          );
                                          setTodayNewTaskText('');
                                          setTodayAddingTaskSubId(null);
                                        }
                                      }}
                                      className="bg-white border border-emerald-200 rounded-xl p-2.5 space-y-2 shadow-2xs"
                                    >
                                      <div className="flex gap-2">
                                        <input
                                          type="text"
                                          placeholder={`Add a task to ${sub.name}…`}
                                          value={todayNewTaskText}
                                          onChange={(e) => setTodayNewTaskText(e.target.value)}
                                          className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
                                          autoFocus
                                        />
                                        <button
                                          type="submit"
                                          disabled={!todayNewTaskText.trim()}
                                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition cursor-pointer"
                                        >
                                          Add
                                        </button>
                                      </div>
                                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                        <span>Priority:</span>
                                        <select
                                          value={todayNewTaskPriority}
                                          onChange={(e) =>
                                            setTodayNewTaskPriority(
                                              e.target.value as 'high' | 'medium' | 'low'
                                            )
                                          }
                                          className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 text-[11px]"
                                        >
                                          <option value="high">High</option>
                                          <option value="medium">Medium</option>
                                          <option value="low">Low</option>
                                        </select>
                                      </div>
                                    </form>
                                  )}

                                  <div className="space-y-1.5 pt-1">
                                    {subTasks.length === 0 ? (
                                      <p className="text-[11px] text-slate-400 py-1 italic">
                                        No tasks in this group for today yet.
                                      </p>
                                    ) : (
                                      subTasks.map((task) => {
                                        const isEditingThisTask = todayEditingTaskId === task.id;
                                        const canEditThis = canEditTaskRecord(g.id, task);

                                        if (isEditingThisTask) {
                                          return (
                                            <div
                                              key={task.id}
                                              className="p-2.5 rounded-lg border border-emerald-300 bg-emerald-50/30 space-y-2"
                                            >
                                              <input
                                                type="text"
                                                value={todayEditTaskText}
                                                onChange={(e) => setTodayEditTaskText(e.target.value)}
                                                className="w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                autoFocus
                                              />
                                              <div className="flex items-center justify-between gap-2">
                                                <select
                                                  value={todayEditTaskPriority}
                                                  onChange={(e) =>
                                                    setTodayEditTaskPriority(
                                                      e.target.value as 'high' | 'medium' | 'low'
                                                    )
                                                  }
                                                  className="text-[11px] bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-700"
                                                >
                                                  <option value="high">High Priority</option>
                                                  <option value="medium">Medium Priority</option>
                                                  <option value="low">Low Priority</option>
                                                </select>
                                                <div className="flex items-center gap-1.5">
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      if (todayEditTaskText.trim()) {
                                                        handleUpdateTask(g.id, task.id, {
                                                          text: todayEditTaskText.trim(),
                                                          priority: todayEditTaskPriority,
                                                        });
                                                      }
                                                      setTodayEditingTaskId(null);
                                                    }}
                                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold cursor-pointer"
                                                  >
                                                    Save
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => setTodayEditingTaskId(null)}
                                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[11px] font-semibold cursor-pointer"
                                                  >
                                                    Cancel
                                                  </button>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        }

                                        return (
                                          <div
                                            key={task.id}
                                            className={`flex items-center justify-between p-2.5 rounded-lg border transition ${
                                              task.completed
                                                ? 'bg-white/60 border-slate-100 text-slate-400'
                                                : 'bg-white border-slate-200 shadow-2xs text-slate-800'
                                            }`}
                                          >
                                            <label
                                              className={`flex items-center gap-2.5 flex-1 min-w-0 pr-2 ${
                                                canEditThis ? 'cursor-pointer' : 'cursor-default'
                                              }`}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={task.completed}
                                                disabled={!canEditThis}
                                                onChange={() => handleToggleTask(g.id, task.id)}
                                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-40 cursor-pointer"
                                              />
                                              <span
                                                className={`text-sm ${
                                                  task.completed
                                                    ? 'line-through text-slate-400'
                                                    : 'font-medium'
                                                }`}
                                              >
                                                {task.text}
                                              </span>
                                            </label>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                              <PriorityBadge priority={task.priority} />
                                              {canEditThis && (
                                                <>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setTodayEditingTaskId(task.id);
                                                      setTodayEditTaskText(task.text);
                                                      setTodayEditTaskPriority(task.priority);
                                                    }}
                                                    className="text-slate-400 hover:text-emerald-700 p-1 text-xs transition cursor-pointer"
                                                    title="Edit task text or priority"
                                                  >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleDeleteTask(g.id, task.id)}
                                                    className="text-slate-300 hover:text-rose-500 p-1 text-xs transition cursor-pointer"
                                                    title="Delete task"
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </button>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            {uncategorized.length > 0 && (
                              <div className="bg-slate-50/60 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                  General Tasks
                                </div>
                                <div className="space-y-1.5 pt-1">
                                  {uncategorized.map((task) => (
                                    <div
                                      key={task.id}
                                      className={`flex items-center justify-between p-2.5 rounded-lg border transition ${
                                        task.completed
                                          ? 'bg-white/60 border-slate-100 text-slate-400'
                                          : 'bg-white border-slate-200 shadow-2xs text-slate-800'
                                      }`}
                                    >
                                      <label
                                        className={`flex items-center gap-2.5 flex-1 min-w-0 pr-2 ${
                                          canEditTaskRecord(g.id, task)
                                            ? 'cursor-pointer'
                                            : 'cursor-default'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={task.completed}
                                          disabled={!canEditTaskRecord(g.id, task)}
                                          onChange={() => handleToggleTask(g.id, task.id)}
                                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-40 cursor-pointer"
                                        />
                                        <span
                                          className={`text-sm ${
                                            task.completed
                                              ? 'line-through text-slate-400'
                                              : 'font-medium'
                                          }`}
                                        >
                                          {task.text}
                                        </span>
                                      </label>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <PriorityBadge priority={task.priority} />
                                        {canEditTaskRecord(g.id, task) && (
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteTask(g.id, task.id)}
                                            className="text-slate-300 hover:text-rose-500 p-0.5 text-xs transition cursor-pointer"
                                            title="Delete task"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Quick Add Subcategory for Today Button */}
                            {canManageGoal && (
                              <div className="pt-1">
                                {todayAddingSubGoalId === g.id ? (
                                  <form
                                    onSubmit={async (e) => {
                                      e.preventDefault();
                                      if (todayNewSubName.trim()) {
                                        await handleAddSubcategory(
                                          g.id,
                                          todayNewSubName.trim(),
                                          todayDate
                                        );
                                        setTodayNewSubName('');
                                        setTodayAddingSubGoalId(null);
                                      }
                                    }}
                                    className="bg-slate-50 border border-emerald-300 rounded-xl p-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center"
                                  >
                                    <input
                                      type="text"
                                      placeholder="New Subcategory (e.g. Upper Body Workout, Lunch Plan)…"
                                      value={todayNewSubName}
                                      onChange={(e) => setTodayNewSubName(e.target.value)}
                                      className="flex-1 text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                                      autoFocus
                                    />
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="submit"
                                        disabled={!todayNewSubName.trim()}
                                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg cursor-pointer transition shadow-2xs"
                                      >
                                        Create Subcategory
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setTodayAddingSubGoalId(null);
                                          setTodayNewSubName('');
                                        }}
                                        className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </form>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTodayAddingSubGoalId(g.id);
                                      setTodayNewSubName('');
                                    }}
                                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-dashed border-emerald-300 rounded-xl px-3.5 py-2 transition cursor-pointer flex items-center gap-1.5"
                                  >
                                    <span>+</span>
                                    <span>Add Subcategory for Today</span>
                                  </button>
                                )}
                              </div>
                            )}
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
                  className={`bg-white border rounded-2xl p-4 sm:p-6 shadow-xs transition-colors duration-200 ${
                    !isOwner ? 'border-purple-200/90 shadow-purple-950/5' : 'border-purple-200/80'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {isEditingGoalHeader ? (
                        <div className="bg-purple-50/40 border border-purple-200 rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-800">Edit Goal Details</h3>
                            <button
                              type="button"
                              onClick={() => setIsEditingGoalHeader(false)}
                              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Cancel</span>
                            </button>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Goal Title</label>
                            <input
                              type="text"
                              value={editGoalTitle}
                              onChange={(e) => setEditGoalTitle(e.target.value)}
                              className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Category</label>
                              <input
                                type="text"
                                value={editGoalCategory}
                                onChange={(e) => setEditGoalCategory(e.target.value)}
                                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Description</label>
                              <input
                                type="text"
                                value={editGoalDesc}
                                onChange={(e) => setEditGoalDesc(e.target.value)}
                                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
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
                              className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                            >
                              Save Changes
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsEditingGoalHeader(false)}
                              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium cursor-pointer active:scale-95"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <button
                              onClick={() => {
                                setSelectedGoalId(null);
                                setActiveTab('dashboard');
                              }}
                              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition cursor-pointer shadow-2xs flex items-center gap-1"
                            >
                              ← Back to Dashboard
                            </button>
                            <span
                              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                                isOwner
                                  ? 'text-purple-900 bg-purple-100/90 border-purple-200'
                                  : 'text-blue-950 bg-blue-100/90 border-blue-300'
                              }`}
                            >
                              {currentGoal.category || 'General'}
                            </span>
                            <span
                              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                                isOwner
                                  ? 'text-purple-800 bg-purple-50 border-purple-100'
                                  : 'text-blue-900 bg-blue-50 border-blue-200'
                              }`}
                            >
                              Target: {formatFullMonth(currentGoal.targetDate)}
                            </span>
                            {isOwner && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditGoalTitle(currentGoal.title);
                                  setEditGoalCategory(currentGoal.category || 'General');
                                  setEditGoalDesc(currentGoal.description || '');
                                  setIsEditingGoalHeader(true);
                                }}
                                className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs border ${
                                  isOwner
                                    ? 'text-purple-900 hover:text-purple-950 bg-purple-50 hover:bg-purple-100 border-purple-200'
                                    : 'text-blue-950 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border-blue-300'
                                }`}
                                title="Edit Goal Details"
                              >
                                <Edit2 className={`w-3.5 h-3.5 ${isOwner ? 'text-purple-700' : 'text-blue-700'}`} />
                                <span>Edit Goal</span>
                              </button>
                            )}
                          </div>
                          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{currentGoal.title}</h1>
                          {currentGoal.description && (
                            <p className="text-slate-600 text-sm mt-1 max-w-3xl leading-relaxed">
                              {currentGoal.description}
                            </p>
                          )}
                        </>
                      )}

                      {!isOwner && (
                        <div
                          className={`mt-3 p-3.5 rounded-xl border flex items-center justify-between gap-2.5 text-xs font-semibold flex-wrap ${
                            canEditGoal(currentGoal.id)
                              ? 'bg-blue-50/90 border-blue-300 text-blue-950 shadow-2xs'
                              : 'bg-slate-50 border-slate-300 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <ShieldCheck
                              className={`w-4 h-4 flex-shrink-0 ${
                                canEditGoal(currentGoal.id) ? 'text-blue-600' : 'text-slate-500'
                              }`}
                            />
                            <span>
                              {canEditGoal(currentGoal.id)
                                ? `Trainer Active Mode: Managing ${workspaceProfile?.displayName || 'Client'}'s roadmap as ${professionalRole || 'Professional'}. Routine subcategories and daily tasks sync directly to their view.`
                                : `View-only access: ${workspaceProfile?.displayName || 'your client'} shared this goal with you as ${professionalRole || 'Professional'} for review. Ask them for editing access to change routines and tasks.`}
                            </span>
                          </div>
                        </div>
                      )}

                      {isOwner && profile?.collaborators && profile.collaborators.length > 0 && (
                        <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
                          <span className="text-slate-500 font-medium">Assigned Professionals:</span>
                          {(() => {
                            const assigned = profile.collaborators.filter((c) =>
                              isGoalSharedWith(c, currentGoal.id)
                            );
                            if (assigned.length === 0) {
                              return <span className="text-slate-400 italic">None assigned</span>;
                            }
                            return assigned.map((c) => (
                              <span
                                key={c.uid}
                                className="inline-flex items-center gap-1 bg-purple-50 border border-purple-200 text-purple-900 font-semibold px-2 py-0.5 rounded-md text-[11px]"
                              >
                                <span>{c.name || c.email || 'Pro'}</span>
                                <span className="text-purple-700 font-normal">({c.role})</span>
                              </span>
                            ));
                          })()}
                          <button
                            type="button"
                            onClick={() => setManagingAssignedGoal(currentGoal)}
                            className="text-xs font-semibold text-purple-900 hover:text-purple-950 hover:bg-purple-100/70 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 transition cursor-pointer flex items-center gap-1"
                          >
                            <Settings className="w-3 h-3 text-purple-700" />
                            <span>Manage Access</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center flex-wrap gap-2 self-start">
                      {isOwner && (
                        <>
                          {profile?.collaborators && profile.collaborators.length > 0 && (
                            <button
                              onClick={() => setManagingAssignedGoal(currentGoal)}
                              className="hidden sm:flex text-xs text-purple-950 hover:text-purple-950 bg-purple-50/60 hover:bg-purple-100 border border-purple-200 px-3.5 py-1.5 rounded-xl transition font-semibold cursor-pointer items-center gap-1.5 shadow-2xs"
                              title="Manage assigned professionals"
                            >
                              <Users className="w-3.5 h-3.5 text-purple-700" />
                              <span>
                                {profile.collaborators.filter((c) =>
                                  isGoalSharedWith(c, currentGoal.id)
                                ).length > 0
                                  ? 'Assigned Pros'
                                  : 'Assign Pros'}
                              </span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setGiveUpTargetGoal(currentGoal)}
                            className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 px-3.5 py-1.5 rounded-xl transition font-semibold cursor-pointer flex items-center gap-1.5 shadow-2xs"
                            title="Give up on this goal"
                          >
                            <Flag className="w-3.5 h-3.5 text-rose-500" />
                            <span>Give Up</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2-Column Responsive Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* LEFT: Daily Task Execution */}
                  <div className="lg:col-span-6 space-y-6">
                    <DailyTaskSection
                      goal={currentGoal}
                      isOwner={isOwner}
                      canManageCategories={canEditGoal(currentGoal.id)}
                      professionalRole={professionalRole}
                      selectedMonthKey={selectedGoalMonth}
                      onSelectMonth={setSelectedGoalMonth}
                      canEditSubcategoryTasks={(sub) => canEditSubcategoryTasks(currentGoal.id, sub)}
                      onAddSubcategory={handleAddSubcategory}
                      onRenameSubcategory={handleRenameSubcategory}
                      onDeleteSubcategory={handleDeleteSubcategory}
                      onSetSubcategoryRole={handleSetSubcategoryRole}
                      onAddTask={handleAddTask}
                      onUpdateTask={handleUpdateTask}
                      onToggleTask={handleToggleTask}
                      onDeleteTask={handleDeleteTask}
                    />
                  </div>

                  {/* RIGHT: Monthly Milestones Timeline */}
                  <div className="lg:col-span-6 space-y-6">
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
              <ProfessionalProfilePanel
                user={user}
                profile={profile}
                onError={setErrorMessage}
              />
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
              />
            )}
          </>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white py-3.5 sm:py-6 mt-6 sm:mt-12">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-4 text-[11px] sm:text-xs text-slate-500 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span>Goal Path App</span>
            <span>•</span>
            <span>Firestore Cloud Sync Active</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Logged in as: <span className="font-medium text-slate-700">{user.email}</span></span>
          </div>
        </div>
      </footer>

      {/* CREATE GOAL MODAL */}
      <CreateGoalModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        collaborators={profile?.collaborators || []}
        onSave={handleCreateGoal}
      />

      {/* GOAL ASSIGNMENT MODAL */}
      <GoalAssignmentModal
        isOpen={!!managingAssignedGoal}
        onClose={() => setManagingAssignedGoal(null)}
        goal={managingAssignedGoal}
        collaborators={profile?.collaborators || []}
        onSave={handleSaveGoalCollaboratorAssignments}
      />

      {/* GIVE UP MOTIVATIONAL INTERVENTION MODAL */}
      <GiveUpInterventionModal
        isOpen={!!giveUpTargetGoal}
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

      {/* FIRST-RUN QUESTION: asked once, changeable later from the account menu */}
      <PersonaPrompt
        isOpen={
          !!user &&
          !!profile &&
          !dataLoading &&
          !savingPersona &&
          (!profile.persona && !personaPromptDismissed ? true : personaPickerOpen)
        }
        saving={savingPersona}
        onChoose={handleChoosePersona}
        onSkip={() => {
          setPersonaPromptDismissed(true);
          setPersonaPickerOpen(false);
        }}
      />
    </div>
  );
}
