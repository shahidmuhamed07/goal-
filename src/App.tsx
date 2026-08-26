/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
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
} from './types';
import {
  getTodayDateString,
  getCurrentMonthKey,
  formatMonthKey,
  formatFullMonth,
  generateMonthRange,
  generateInviteCode,
  requestDocId,
  PROFESSIONAL_ROLES,
  getMonthDays,
  formatDisplayDate,
} from './utils';

import { LoginScreen } from './components/LoginScreen';
import { PriorityBadge, ProgressBar } from './components/UIElements';
import { DailyTaskSection } from './components/DailyTaskSection';
import { MonthlyMilestoneSection } from './components/MonthlyMilestoneSection';
import { CollaboratorsPanel } from './components/CollaboratorsPanel';
import { CreateGoalModal } from './components/CreateGoalModal';
import { GoalAssignmentModal } from './components/GoalAssignmentModal';
import goalPathLogo from './assets/images/goal_path_logo_1787491130948.jpg';
import goalPathHero from './assets/images/goal_path_hero_1787491145015.jpg';

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
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Data State
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // UI View State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'today' | 'detail' | 'connect'>('dashboard');
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
  const [workspaceUid, setWorkspaceUid] = useState<string | null>(null);
  const [connectNotice, setConnectNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [incomingError, setIncomingError] = useState<string | null>(null);

  // Listen for Firebase Auth State Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        if (!isDemoMode) {
          setUser(currentUser);
        }
        setAuthLoading(false);
      },
      (err) => {
        console.error('Auth state error:', err);
        setAuthError(err.message);
        setAuthLoading(false);
      }
    );
    return () => unsubscribe();
  }, [isDemoMode]);

  useEffect(() => {
    if (!user || isDemoMode) {
      if (!isDemoMode) {
        setWorkspaceUid(null);
        setProfile(null);
      }
      return;
    }
    setWorkspaceUid((prev) => prev || user.uid);
    ensureUserProfile(user).catch((err) => {
      console.error('ensureUserProfile:', err);
      setErrorMessage(
        err.message || 'Could not set up your access code. Check Firestore rules for users/codes.'
      );
    });
  }, [user, isDemoMode]);

  useEffect(() => {
    if (!user || isDemoMode) {
      if (!isDemoMode) setProfile(null);
      return undefined;
    }
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) setProfile({ id: snap.id, ...snap.data() } as UserProfile);
      },
      (err) => {
        console.error('Profile listener:', err);
        setErrorMessage('Unable to load your profile. Allow read/write on the users collection.');
      }
    );
    return () => unsub();
  }, [user, isDemoMode]);

  useEffect(() => {
    if (!user || isDemoMode) {
      if (!isDemoMode) {
        setIncomingRequests([]);
        setOutgoingRequests([]);
        setIncomingError(null);
      }
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
  }, [user, isDemoMode]);

  // Realtime client list & active client profile listener
  const [activeClientProfile, setActiveClientProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!user || isDemoMode) {
      if (!isDemoMode) {
        setClientList([]);
        setClientsReady(false);
      }
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
  }, [user, isDemoMode]);

  // Realtime listener for active client workspace if switching to a client's account
  useEffect(() => {
    if (!user || !workspaceUid || workspaceUid === user.uid || isDemoMode) {
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
  }, [user, workspaceUid, isDemoMode]);

  useEffect(() => {
    if (!user || !workspaceUid || workspaceUid === user.uid || isDemoMode) return;
    if (!clientsReady) return;
    if (!clientList.some((c) => c.id === workspaceUid) && !activeClientProfile) {
      setWorkspaceUid(user.uid);
      setActiveTab('dashboard');
      setSelectedGoalId(null);
    }
  }, [user, workspaceUid, clientList, activeClientProfile, clientsReady, isDemoMode]);

  // Realtime Firestore: goals for active workspace
  useEffect(() => {
    if (isDemoMode) return;
    if (!user || !workspaceUid) {
      setGoals([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    setErrorMessage(null);

    const goalsRef = collection(db, 'goals');
    const q = query(goalsRef, where('userId', '==', workspaceUid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedGoals: Goal[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          fetchedGoals.push({
            id: docSnap.id,
            userId: data.userId,
            title: data.title,
            category: data.category,
            description: data.description || '',
            createdAt: data.createdAt,
            targetDate: data.targetDate,
            milestones: data.milestones || [],
            subcategories: data.subcategories || [],
            tasks: data.tasks || [],
          });
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

  // Any authenticated collaborator in this workspace has full permission to edit and manage routines & tasks
  const isGoalAssignedToMe = (_goalId: string) => {
    return true;
  };

  const canEditSubcategoryTasks = (_goalId: string, _sub?: Subcategory) => {
    return true;
  };

  const canEditTaskRecord = (_goalId: string, _task?: TaskItem) => {
    return true;
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
  const handleEnterDemoMode = () => {
    setIsDemoMode(true);
    const demoUser = {
      uid: 'demo-user',
      displayName: 'Demo Explorer',
      email: 'demo@goalpath.app',
      photoURL: '',
    } as unknown as User;
    setUser(demoUser);
    setWorkspaceUid('demo-user');
    setProfile({
      id: 'demo-user',
      displayName: 'Demo Explorer',
      email: 'demo@goalpath.app',
      photoURL: '',
      code: 'DEMO01',
      collaborators: [],
      collaboratorUids: [],
      createdAt: new Date().toISOString(),
    });

    const curKey = getCurrentMonthKey();
    const months = generateMonthRange(curKey, '2025-12');
    const sampleGoal: Goal = {
      id: 'goal-demo-1',
      userId: 'demo-user',
      title: 'Launch Product MVP & Onboard First 500 Users',
      category: 'Business',
      description: 'Ship initial web & mobile experience, conduct user interviews, and achieve steady retention.',
      createdAt: todayDate,
      targetDate: '2025-12',
      milestones: months.map((m, idx) => ({
        id: `demo-m-${idx}`,
        monthKey: m,
        title:
          idx === 0
            ? 'Complete core interactive workflow and QA'
            : idx === months.length - 1
            ? 'Official public release & beta outreach'
            : `Reach checkpoint for ${formatMonthKey(m)}`,
        completed: idx === 0,
      })),
      subcategories: [
        { id: 'sub-tech', name: 'Product Engineering', order: 0, editorRole: 'Developer' },
        { id: 'sub-mktg', name: 'Growth & Distribution', order: 1, editorRole: 'Manager' },
      ],
      tasks: [
        { id: 't-1', subcategoryId: 'sub-tech', text: 'Set up cloud hosting & automated deployment pipeline', completed: true, date: todayDate, priority: 'high' },
        { id: 't-2', subcategoryId: 'sub-tech', text: 'Review responsive mobile navigation and touch targets', completed: false, date: todayDate, priority: 'medium' },
        { id: 't-3', subcategoryId: 'sub-mktg', text: 'Draft launch announcement & early access email list', completed: false, date: todayDate, priority: 'high' },
      ],
    };
    setGoals([sampleGoal]);
    setDataLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      setIsDemoMode(false);
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
      if (!isDemoMode) {
        await signOut(auth);
      }
      setUser(null);
      setIsDemoMode(false);
      setSelectedGoalId(null);
      setActiveTab('dashboard');
      setWorkspaceUid(null);
    } catch (err) {
      console.error('Sign Out Error:', err);
      setErrorMessage('Failed to sign out.');
    }
  };

  // FIRESTORE / LOCAL GOAL ACTIONS
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

    if (isDemoMode) {
      setGoals((prev) => [docData, ...prev]);
      setSelectedGoalId(newGoalId);
      setActiveTab('detail');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'goals'), docData);
      const createdId = docRef.id;

      // If specific professionals were assigned during creation:
      if (newGoalData.assignedProfessionalUids && newGoalData.assignedProfessionalUids.length > 0) {
        const userRef = doc(db, 'users', user.uid);
        const fresh = await getDoc(userRef);
        const data = fresh.data() || {};
        const collaborators: Collaborator[] = data.collaborators || [];

        const updatedCollabs = collaborators.map((c) => {
          if (newGoalData.assignedProfessionalUids?.includes(c.uid)) {
            const currentIds = c.assignedGoalIds !== undefined ? c.assignedGoalIds : goals.map((g) => g.id);
            return {
              ...c,
              assignedGoalIds: Array.from(new Set([...currentIds, createdId])),
            };
          }
          return c;
        });

        await updateDoc(userRef, { collaborators: updatedCollabs });
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
    if (!isOwner && !isGoalAssignedToMe(goalId)) {
      setErrorMessage('You are not authorized to edit this goal.');
      return;
    }
    const targetGoal = goals.find((g) => g.id === goalId);
    if (!targetGoal) return;

    if (isDemoMode) {
      setGoals((prev) =>
        prev.map((g) => (g.id === goalId ? { ...g, ...updates } : g))
      );
      return;
    }

    try {
      await updateDoc(doc(db, 'goals', goalId), updates);
    } catch (err) {
      console.error('Update goal details error:', err);
      setErrorMessage('Failed to update goal details.');
    }
  };

  const handleGiveUpGoal = async (goalId: string) => {
    if (!isOwner) return;

    if (isDemoMode) {
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
      if (selectedGoalId === goalId) {
        setSelectedGoalId(null);
        setActiveTab('dashboard');
      }
      return;
    }

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

  const handleToggleMilestone = async (goalId: string, milestoneId: string) => {
    if (!isOwner && !isGoalAssignedToMe(goalId)) return;
    const targetGoal = goals.find((g) => g.id === goalId);
    if (!targetGoal) return;

    const updatedMilestones = targetGoal.milestones.map((m) =>
      m.id === milestoneId ? { ...m, completed: !m.completed } : m
    );

    if (isDemoMode) {
      setGoals((prev) =>
        prev.map((g) => (g.id === goalId ? { ...g, milestones: updatedMilestones } : g))
      );
      return;
    }

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
    if (!isOwner && !isGoalAssignedToMe(goalId)) return;
    const targetGoal = goals.find((g) => g.id === goalId);
    if (!targetGoal) return;

    const updatedMilestones = targetGoal.milestones.map((m) =>
      m.id === milestoneId ? { ...m, title } : m
    );

    if (isDemoMode) {
      setGoals((prev) =>
        prev.map((g) => (g.id === goalId ? { ...g, milestones: updatedMilestones } : g))
      );
      return;
    }

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
    if (!isOwner && !isGoalAssignedToMe(goalId)) {
      setErrorMessage('You are not authorized to add subcategories to this goal.');
      return null;
    }
    const targetGoal = goals.find((g) => g.id === goalId);
    if (!targetGoal) return null;

    const newSub: Subcategory = {
      id: `sc-${Date.now()}`,
      name,
      order: (targetGoal.subcategories || []).length,
      date: date || todayDate,
      editorRole: isOwner ? null : (professionalRole || null),
    };

    if (isDemoMode) {
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goalId
            ? { ...g, subcategories: [...(g.subcategories || []), newSub] }
            : g
        )
      );
      return newSub.id;
    }

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
    if (!isOwner && !isGoalAssignedToMe(goalId)) return;
    const targetGoal = goals.find((g) => g.id === goalId);
    if (!targetGoal) return;

    const updatedSubcategories = (targetGoal.subcategories || []).map((s) =>
      s.id === subcategoryId ? { ...s, name } : s
    );

    if (isDemoMode) {
      setGoals((prev) =>
        prev.map((g) => (g.id === goalId ? { ...g, subcategories: updatedSubcategories } : g))
      );
      return;
    }

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
    if (!isOwner && !isGoalAssignedToMe(goalId)) return;

    const targetGoal = goals.find((g) => g.id === goalId);
    if (!targetGoal) return;

    const updatedSubcategories = (targetGoal.subcategories || []).filter(
      (s) => s.id !== subcategoryId
    );
    const updatedTasks = (targetGoal.tasks || []).filter((t) => t.subcategoryId !== subcategoryId);

    if (isDemoMode) {
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goalId
            ? { ...g, subcategories: updatedSubcategories, tasks: updatedTasks }
            : g
        )
      );
      return;
    }

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
    if (!isOwner && !isGoalAssignedToMe(goalId)) return;
    const targetGoal = goals.find((g) => g.id === goalId);
    if (!targetGoal) return;

    const updatedSubcategories = (targetGoal.subcategories || []).map((s) =>
      s.id === subcategoryId ? { ...s, editorRole: editorRole || null } : s
    );

    if (isDemoMode) {
      setGoals((prev) =>
        prev.map((g) => (g.id === goalId ? { ...g, subcategories: updatedSubcategories } : g))
      );
      return;
    }

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

    if (!isOwner) {
      if (!isGoalAssignedToMe(goalId)) {
        setErrorMessage('You are not assigned to edit this goal by the client.');
        return;
      }
    }

    const newTask: TaskItem = {
      id: `t-${Date.now()}`,
      text,
      priority: priority || 'medium',
      completed: false,
      date: date || todayDate,
      subcategoryId: subcategoryId || '',
    };

    if (isDemoMode) {
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goalId ? { ...g, tasks: [newTask, ...g.tasks] } : g
        )
      );
      return;
    }

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

    if (isDemoMode) {
      setGoals((prev) =>
        prev.map((g) => (g.id === goalId ? { ...g, tasks: updatedTasks } : g))
      );
      return;
    }

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

    if (isDemoMode) {
      setGoals((prev) =>
        prev.map((g) => (g.id === goalId ? { ...g, tasks: updatedTasks } : g))
      );
      return;
    }

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

    if (isDemoMode) {
      setGoals((prev) =>
        prev.map((g) => (g.id === goalId ? { ...g, tasks: updatedTasks } : g))
      );
      return;
    }

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

      const reqRef = doc(db, 'accessRequests', requestDocId(user.uid, toUid));
      const existing = await getDoc(reqRef);
      if (existing.exists()) {
        const status = existing.data().status;
        if (status === 'pending') {
          setConnectNotice({ type: 'error', text: 'A request is already waiting for this client.' });
          return;
        }
        if (status === 'approved') {
          setConnectNotice({ type: 'error', text: 'You already have access to this client.' });
          return;
        }
      }

      await setDoc(reqRef, {
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

  const handleApproveRequest = async (request: AccessRequest, assignedGoalIds: string[]) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const fresh = await getDoc(userRef);
      const data = fresh.data() || {};
      const collaborators = data.collaborators || [];
      const collaboratorUids = data.collaboratorUids || [];

      const updatedCollaborators = [
        ...collaborators.filter((c: { uid: string }) => c.uid !== request.fromUid),
        {
          uid: request.fromUid,
          role: request.role,
          addedAt: new Date().toISOString(),
          name: request.fromName || '',
          email: request.fromEmail || '',
          assignedGoalIds: assignedGoalIds,
        },
      ];

      const updatedUids = Array.from(new Set([...collaboratorUids, request.fromUid]));

      await updateDoc(userRef, {
        collaborators: updatedCollaborators,
        collaboratorUids: updatedUids,
      });

      await updateDoc(doc(db, 'accessRequests', request.id), { status: 'approved' });
    } catch (err) {
      console.error('Approve request error:', err);
      setErrorMessage('Failed to approve request.');
    }
  };

  const handleUpdateAssignedGoals = async (professionalUid: string, assignedGoalIds: string[]) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const fresh = await getDoc(userRef);
      const data = fresh.data() || {};
      const collaborators: Collaborator[] = data.collaborators || [];

      const updated = collaborators.map((c) =>
        c.uid === professionalUid ? { ...c, assignedGoalIds } : c
      );

      await updateDoc(userRef, {
        collaborators: updated,
      });
    } catch (err) {
      console.error('Update assigned goals error:', err);
      setErrorMessage('Failed to update assigned goals.');
    }
  };

  const handleSaveGoalCollaboratorAssignments = async (
    goalId: string,
    assignedCollaboratorUids: string[]
  ) => {
    if (!user || !isOwner) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const fresh = await getDoc(userRef);
      const data = fresh.data() || {};
      const collaborators: Collaborator[] = data.collaborators || [];

      const updated = collaborators.map((c) => {
        const shouldBeAssigned = assignedCollaboratorUids.includes(c.uid);
        const currentIds = c.assignedGoalIds !== undefined ? c.assignedGoalIds : goals.map((g) => g.id);
        const nextIds = shouldBeAssigned
          ? Array.from(new Set([...currentIds, goalId]))
          : currentIds.filter((id) => id !== goalId);

        return {
          ...c,
          assignedGoalIds: nextIds,
        };
      });

      await updateDoc(userRef, {
        collaborators: updated,
      });
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

      if (isDemoMode) {
        return;
      }

      await updateDoc(userRef, {
        collaborators: nextCollaborators,
        collaboratorUids: nextCollaboratorUids,
      });

      // Update access request status to removed
      const reqId = requestDocId(professionalUid, user.uid);
      const reqRef = doc(db, 'accessRequests', reqId);
      const reqSnap = await getDoc(reqRef);
      if (reqSnap.exists()) {
        await updateDoc(reqRef, { status: 'removed' });
      }

      // Also clean up any other matching request docs
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
        onEnterDemoMode={handleEnterDemoMode}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/90 text-slate-900 relative selection:bg-emerald-100 selection:text-emerald-900 overflow-x-hidden">
      {/* Non-intrusive ambient background layer */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        {/* Delicate geometric micro-dot grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
        {/* Soft, low-contrast ambient color washes */}
        <div className="absolute -top-32 right-1/4 w-[500px] h-[500px] bg-emerald-100/35 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-32 w-[450px] h-[450px] bg-teal-100/25 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-slate-200/40 rounded-full blur-3xl" />
      </div>
      {isDemoMode && (
        <div className="bg-emerald-700 text-white text-xs px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="bg-white/20 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">Demo Mode</span>
            <span>Exploring Goal Path with sample data. Whitelist your domain in Firebase Console to use Google Sign-in.</span>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-[11px] font-semibold bg-white text-emerald-900 hover:bg-emerald-50 px-2.5 py-1 rounded-lg transition cursor-pointer flex-shrink-0"
          >
            Sign in with Google →
          </button>
        </div>
      )}

      {/* ERROR NOTIFICATION BANNER */}
      {errorMessage && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-xs text-rose-700 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="font-bold text-rose-500 hover:text-rose-800 ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* TOP NAVIGATION BAR */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 min-h-[4rem] py-2 sm:py-0 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5">
          {/* Logo / Brand */}
          <div
            onClick={() => {
              setSelectedGoalId(null);
              setActiveTab('dashboard');
            }}
            className="flex items-center gap-2.5 cursor-pointer select-none group flex-shrink-0"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden bg-emerald-50 border border-emerald-500/20 shadow-xs flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-200">
              <img
                src={goalPathLogo}
                alt="Goal Path Logo"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="font-bold text-slate-900 leading-none text-sm sm:text-base">Goal Path</div>
              <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium hidden xs:inline">Daily & Monthly Alignment</span>
            </div>
          </div>

          {/* Quick Workspace Switcher if connected to clients */}
          {clientList.length > 0 && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold max-w-[200px] sm:max-w-none">
              <span className="text-[11px] text-slate-500 font-medium pl-1 hidden lg:inline">
                Workspace:
              </span>
              <select
                value={workspaceUid || user.uid}
                onChange={(e) => handleSwitchWorkspace(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800 text-[11px] sm:text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer max-w-[150px] sm:max-w-[220px] truncate"
              >
                <option value={user.uid}>👤 My Personal Goals</option>
                {clientList.map((c) => {
                  const collab = (c.collaborators || []).find((x) => x.uid === user.uid);
                  const roleStr = collab?.role ? ` (${collab.role})` : '';
                  return (
                    <option key={c.id} value={c.id || ''}>
                      🎯 {c.displayName || c.email || 'Client'}{roleStr}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* View Switcher Tabs */}
          <nav className="flex items-center bg-slate-100 p-1 rounded-xl gap-0.5 sm:gap-1 text-[11px] sm:text-xs font-semibold order-last sm:order-none w-full sm:w-auto justify-center sm:justify-start">
            <button
              onClick={() => {
                setSelectedGoalId(null);
                setActiveTab('dashboard');
              }}
              className={`flex-1 sm:flex-initial text-center px-2.5 sm:px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Goals ({goals.length})
            </button>
            <button
              onClick={() => setActiveTab('today')}
              className={`flex-1 sm:flex-initial justify-center px-2.5 sm:px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'today'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Today's Focus</span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 rounded-full font-bold">
                {allTodayTasks.filter((t) => !t.completed).length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('connect')}
              className={`flex-1 sm:flex-initial justify-center px-2.5 sm:px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'connect'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Collaborate</span>
              {pendingIncoming.length > 0 && (
                <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 rounded-full font-bold">
                  {pendingIncoming.length}
                </span>
              )}
            </button>
          </nav>

          {/* Action Buttons & User Menu */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {!isOwner ? (
              <button
                type="button"
                onClick={() => handleSwitchWorkspace(user.uid)}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95 border border-emerald-600"
                title="Exit client workspace and return to your own dashboard"
              >
                <span>🚪</span>
                <span>Exit Client</span>
              </button>
            ) : (
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span>+</span>
                <span className="hidden xs:inline">New Goal</span>
              </button>
            )}

            {/* User Avatar + Sign Out */}
            <div className="flex items-center gap-1.5 sm:gap-2 pl-2 border-l border-slate-200">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-7 h-7 rounded-full border border-slate-200"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700">
                  {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                </div>
              )}

              <button
                onClick={handleSignOut}
                title="Sign Out"
                className="text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg transition cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {!isOwner && workspaceProfile && (
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-emerald-500/40 text-white px-3 sm:px-6 py-3 text-xs shadow-md sticky top-16 z-20">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="flex h-3 w-3 relative flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                  Client Workspace:
                </span>
                <span className="bg-emerald-950/90 text-emerald-300 font-bold px-2 py-0.5 rounded-md border border-emerald-500/30">
                  {workspaceProfile.displayName || workspaceProfile.email || 'Client'}
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-300">
                  Your Role: <strong className="text-emerald-400 uppercase tracking-wider font-bold">{professionalRole || 'Professional'}</strong>
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleSwitchWorkspace(user.uid)}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold transition cursor-pointer text-xs flex items-center justify-center gap-2 shadow-xs border border-emerald-400/50 active:scale-95"
            >
              <span>🚪</span>
              <span>Exit Client Workspace (Back to My Account)</span>
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full relative z-10">
        {dataLoading && activeTab !== 'connect' ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <span className="text-xs font-semibold text-slate-400">Loading your goals from cloud...</span>
          </div>
        ) : (
          <>
            {/* VIEW 1: ALL GOALS DASHBOARD */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* Dashboard Metrics Hero Banner */}
                <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm text-white">
                  {/* Filling Hero Background Image */}
                  <img
                    src={goalPathHero}
                    alt="Goal Path Horizon"
                    className="absolute inset-0 w-full h-full object-cover object-right opacity-35 select-none pointer-events-none"
                    referrerPolicy="no-referrer"
                  />
                  {/* Smooth Gradient Overlay for optimal legibility */}
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-transparent pointer-events-none" />

                  {/* Content Container */}
                  <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="max-w-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-950/80 border border-emerald-500/30 px-2.5 py-0.5 rounded-md">
                          Cloud Synced Roadmap
                        </span>
                        <span className="text-xs text-slate-300">
                          Horizon & Daily Action
                        </span>
                      </div>
                      <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                        Transform Vision Into Milestones
                      </h1>
                      <p className="text-slate-300 text-xs sm:text-sm mt-1.5 leading-relaxed">
                        Signed in as <span className="font-semibold text-white">{user.displayName || user.email}</span>. Break long-term ambition down into actionable monthly milestones and daily wins.
                      </p>
                    </div>

                    {/* Metrics Stat Cards with Frosted Glass look */}
                    <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 flex-shrink-0">
                      <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3 sm:px-4 sm:py-3 text-center sm:text-left">
                        <div className="text-xl sm:text-2xl font-black text-white">{goals.length}</div>
                        <div className="text-[11px] text-slate-300 font-medium">Active Goals</div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3 sm:px-4 sm:py-3 text-center sm:text-left">
                        <div className="text-xl sm:text-2xl font-black text-emerald-400">
                          {allTodayTasks.filter((t) => t.completed).length}/{allTodayTasks.length}
                        </div>
                        <div className="text-[11px] text-slate-300 font-medium">Tasks Today</div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3 sm:px-4 sm:py-3 text-center sm:text-left">
                        <div className="text-xl sm:text-2xl font-black text-white">{overallProgress}%</div>
                        <div className="text-[11px] text-slate-300 font-medium">Progress</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Client Workspaces You Support (Shown if you are a professional connected to clients) */}
                {isOwner && clientList.length > 0 && (
                  <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-800 space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/90 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                            Professional Access
                          </span>
                          <span className="text-xs text-slate-300">
                            {clientList.length} Connected Client{clientList.length > 1 ? 's' : ''}
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
                      {clientList.map((client) => {
                        const collab = (client.collaborators || []).find((c) => c.uid === user.uid);
                        const myRole = collab?.role || 'Professional';
                        const assignedCount =
                          collab?.assignedGoalIds !== undefined
                            ? collab.assignedGoalIds.length
                            : 'All';

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
                                  {myRole}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                {client.email}
                              </p>
                              <div className="text-xs text-slate-300 mt-2.5 flex items-center gap-1.5 font-medium">
                                <span>🎯</span>
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
                              <span>→</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative w-full sm:w-72">
                    <input
                      type="text"
                      placeholder="Search goals or descriptions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    />
                    <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs">🔍</span>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1">
                    <span className="text-xs text-slate-400 font-medium flex-shrink-0">Category:</span>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`text-xs px-3 py-1 rounded-full font-medium capitalize whitespace-nowrap transition cursor-pointer ${
                          selectedCategory === cat
                            ? 'bg-slate-900 text-white'
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
                    <div className="text-4xl mb-2">🎯</div>
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
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-4 py-2 rounded-xl cursor-pointer"
                      >
                        + Create New Goal
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
                      const isAssigned = isGoalAssignedToMe(goal.id);

                      return (
                        <div
                          key={goal.id}
                          onClick={() => {
                            setSelectedGoalId(goal.id);
                            setSelectedGoalMonth(getCurrentMonthKey());
                            setActiveTab('detail');
                          }}
                          className={`group bg-white border rounded-2xl p-5 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                            !isOwner && isAssigned
                              ? 'border-emerald-300 ring-2 ring-emerald-500/15 shadow-2xs'
                              : 'border-slate-200/90 hover:border-emerald-500/40'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                                {goal.category || 'General'}
                              </span>
                              <span className="text-xs font-medium text-slate-400">
                                Target: {formatMonthKey(goal.targetDate)}
                              </span>
                            </div>

                            <h3 className="font-bold text-slate-900 text-base group-hover:text-emerald-700 transition-colors line-clamp-1 mb-1">
                              {goal.title}
                            </h3>

                            {isOwner && profile?.collaborators && profile.collaborators.length > 0 && (
                              <div className="flex items-center justify-between gap-1 mb-2.5 pt-0.5">
                                {(() => {
                                  const assigned = profile.collaborators.filter((c) =>
                                    c.assignedGoalIds !== undefined
                                      ? c.assignedGoalIds.includes(goal.id)
                                      : true
                                  );
                                  const isAssigned = assigned.length > 0;
                                  return (
                                    <>
                                      <span
                                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                                          isAssigned
                                            ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                                            : 'text-slate-500 bg-slate-100 border-slate-200'
                                        }`}
                                      >
                                        👥 {assigned.length}/{profile.collaborators.length} Pros
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
                                        <span>{isAssigned ? '✓ Assigned' : '+ Assign Pro'}</span>
                                      </button>
                                    </>
                                  );
                                })()}
                              </div>
                            )}

                            {!isOwner && (
                              <div className="mb-2.5">
                                {isAssigned ? (
                                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span>Assigned Session ({professionalRole || 'Trainer'})</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                                    <span>🔒</span>
                                    <span>Read-only (Not assigned to your role)</span>
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
                                    curMilestone?.completed ? 'bg-emerald-500' : 'bg-amber-500'
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
                                {isAssigned ? (
                                  <div className="w-full bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 group-hover:bg-emerald-600 group-hover:text-white transition shadow-2xs">
                                    <span>✏️ Edit Subcategories & Routines</span>
                                    <span>→</span>
                                  </div>
                                ) : (
                                  <div className="w-full bg-slate-50 text-slate-400 text-xs py-1.5 px-3 rounded-xl text-center font-medium">
                                    🔒 View Only
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
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto text-xl font-bold">
                      ✓
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
                          className="px-3.5 py-1.5 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 text-slate-700 hover:text-emerald-800 text-xs font-semibold rounded-xl transition cursor-pointer"
                        >
                          → {g.title}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {goals.map((g) => {
                      const goalTodayTasks = (g.tasks || []).filter((t) => t.date === todayDate);
                      const canManageGoal = isOwner || isGoalAssignedToMe(g.id);
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
                          className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4"
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
                                          {isAddingTask ? '✕ Cancel' : '+ Add Task'}
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
                                                    ✏️
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleDeleteTask(g.id, task.id)}
                                                    className="text-slate-300 hover:text-rose-500 p-1 text-xs transition cursor-pointer"
                                                    title="Delete task"
                                                  >
                                                    ✕
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
                                            ✕
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
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {isEditingGoalHeader ? (
                        <div className="bg-slate-50 border border-emerald-300 rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-800">Edit Goal Details</h3>
                            <button
                              type="button"
                              onClick={() => setIsEditingGoalHeader(false)}
                              className="text-xs text-slate-500 hover:text-slate-700"
                            >
                              ✕ Cancel
                            </button>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Goal Title</label>
                            <input
                              type="text"
                              value={editGoalTitle}
                              onChange={(e) => setEditGoalTitle(e.target.value)}
                              className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Category</label>
                              <input
                                type="text"
                                value={editGoalCategory}
                                onChange={(e) => setEditGoalCategory(e.target.value)}
                                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Description</label>
                              <input
                                type="text"
                                value={editGoalDesc}
                                onChange={(e) => setEditGoalDesc(e.target.value)}
                                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800"
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
                              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                            >
                              Save Changes
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsEditingGoalHeader(false)}
                              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
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
                              className="text-xs font-semibold text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
                            >
                              ← Back to Dashboard
                            </button>
                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                              {currentGoal.category || 'General'}
                            </span>
                            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                              Target: {formatFullMonth(currentGoal.targetDate)}
                            </span>
                            {(isOwner || isGoalAssignedToMe(currentGoal.id)) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditGoalTitle(currentGoal.title);
                                  setEditGoalCategory(currentGoal.category || 'General');
                                  setEditGoalDesc(currentGoal.description || '');
                                  setIsEditingGoalHeader(true);
                                }}
                                className="text-xs font-semibold text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Edit Goal Details"
                              >
                                <span>✏️</span>
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
                          className={`mt-3 p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold ${
                            isGoalAssignedToMe(currentGoal.id)
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-amber-50 border-amber-200 text-amber-800'
                          }`}
                        >
                          <span>{isGoalAssignedToMe(currentGoal.id) ? '🟢' : '🔒'}</span>
                          <span>
                            {isGoalAssignedToMe(currentGoal.id)
                              ? `You are assigned to this goal as ${professionalRole}. You can add subcategories, schedule routines, and manage tasks.`
                              : `Read-Only: This goal has not been assigned to you by the client.`}
                          </span>
                        </div>
                      )}

                      {isOwner && profile?.collaborators && profile.collaborators.length > 0 && (
                        <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
                          <span className="text-slate-500 font-medium">Assigned Professionals:</span>
                          {(() => {
                            const assigned = profile.collaborators.filter((c) =>
                              c.assignedGoalIds !== undefined
                                ? c.assignedGoalIds.includes(currentGoal.id)
                                : true
                            );
                            if (assigned.length === 0) {
                              return <span className="text-slate-400 italic">None assigned</span>;
                            }
                            return assigned.map((c) => (
                              <span
                                key={c.uid}
                                className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold px-2 py-0.5 rounded-md text-[11px]"
                              >
                                <span>{c.name || c.email || 'Pro'}</span>
                                <span className="text-emerald-600 font-normal">({c.role})</span>
                              </span>
                            ));
                          })()}
                          <button
                            type="button"
                            onClick={() => setManagingAssignedGoal(currentGoal)}
                            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 transition cursor-pointer"
                          >
                            ⚙️ Manage Access
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-start">
                      {isOwner && (
                        <>
                          {profile?.collaborators && profile.collaborators.length > 0 && (
                            <button
                              onClick={() => setManagingAssignedGoal(currentGoal)}
                              className="text-xs text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3.5 py-1.5 rounded-xl transition font-semibold cursor-pointer flex items-center gap-1.5 shadow-2xs"
                              title="Manage assigned professionals"
                            >
                              <span>👥</span>
                              <span>
                                {profile.collaborators.filter((c) =>
                                  c.assignedGoalIds !== undefined
                                    ? c.assignedGoalIds.includes(currentGoal.id)
                                    : true
                                ).length > 0
                                  ? 'Assigned Pros'
                                  : 'Assign Pros'}
                              </span>
                            </button>
                          )}
                          <button
                            onClick={() => handleGiveUpGoal(currentGoal.id)}
                            className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 px-3.5 py-1.5 rounded-xl transition font-semibold cursor-pointer flex items-center gap-1.5 shadow-2xs"
                            title="Give up on this goal"
                          >
                            <span>🏳️</span>
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
                      canManageCategories={isOwner || isGoalAssignedToMe(currentGoal.id)}
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
                      readOnly={!isOwner && !isGoalAssignedToMe(currentGoal.id)}
                      selectedMonthKey={selectedGoalMonth}
                      onSelectMonth={setSelectedGoalMonth}
                      onToggleMilestone={handleToggleMilestone}
                      onUpdateMilestoneTitle={handleUpdateMilestoneTitle}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'connect' && (
              <CollaboratorsPanel
                user={user}
                profile={profile}
                incomingRequests={incomingRequests}
                incomingError={incomingError}
                outgoingRequests={outgoingRequests}
                clientList={clientList}
                connectNotice={connectNotice}
                workspaceUid={workspaceUid}
                goals={goals}
                onRequestAccess={handleRequestAccess}
                onApprove={handleApproveRequest}
                onDeny={handleDenyRequest}
                onRemove={handleRemoveCollaborator}
                onUpdateAssignedGoals={handleUpdateAssignedGoals}
                onSwitchWorkspace={handleSwitchWorkspace}
              />
            )}
          </>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
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
    </div>
  );
}
