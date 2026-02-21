import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueueRepo, dequeueRepo, getQueue } from '../services/pushQueue';
import { pushRepo } from '../git/gitOps';

const REPOS_KEY = 'gitlane_repos';
const CREDS_KEY = 'gitlane_creds';

export const useStore = create((set, get) => ({
  // ── Repos ──────────────────────────────────────────────────────────────
  repos: [],          // [{dir, name, url, branch, lastOpened}]
  activeRepo: null,   // the currently open repo object

  loadRepos: async () => {
    try {
      const raw = await AsyncStorage.getItem(REPOS_KEY);
      if (raw) set({ repos: JSON.parse(raw) });
    } catch {}
  },

  addRepo: async (repo) => {
    const repos = [...get().repos.filter(r => r.dir !== repo.dir), {
      ...repo,
      lastOpened: Date.now(),
    }];
    set({ repos });
    await AsyncStorage.setItem(REPOS_KEY, JSON.stringify(repos));
  },

  removeRepo: async (dir) => {
    const repos = get().repos.filter(r => r.dir !== dir);
    set({ repos });
    await AsyncStorage.setItem(REPOS_KEY, JSON.stringify(repos));
  },

  setActiveRepo: (repo) => set({ activeRepo: repo }),

  updateRepoBranch: async (dir, branch) => {
    const repos = get().repos.map(r => r.dir === dir ? { ...r, branch } : r);
    set({ repos });
    await AsyncStorage.setItem(REPOS_KEY, JSON.stringify(repos));
  },

  // ── Credentials ────────────────────────────────────────────────────────
  creds: { name: '', email: '', token: '' },

  loadCreds: async () => {
    try {
      const raw = await AsyncStorage.getItem(CREDS_KEY);
      if (raw) set({ creds: JSON.parse(raw) });
    } catch {}
  },

  saveCreds: async (creds) => {
    set({ creds });
    await AsyncStorage.setItem(CREDS_KEY, JSON.stringify(creds));
  },

  // ── UI state ───────────────────────────────────────────────────────────
  cloneProgress: null,   // { phase, loaded, total } | null
  setCloneProgress: (p) => set({ cloneProgress: p }),

  // ── Push queue ─────────────────────────────────────────────────────────
  pendingPushCount: 0,

  loadPendingCount: async () => {
    const queue = await getQueue();
    set({ pendingPushCount: queue.length });
  },

  /** Queue a push for dir/repoName; updates badge count. */
  queuePush: async (dir, repoName) => {
    await enqueueRepo(dir, repoName);
    const queue = await getQueue();
    set({ pendingPushCount: queue.length });
  },

  /**
   * Flush all queued pushes using the current token.
   * Returns { succeeded: number, failed: number }.
   */
  flushPushQueue: async () => {
    const token = get().creds.token || null;
    const queue = await getQueue();
    let succeeded = 0;
    let failed = 0;
    for (const item of queue) {
      try {
        await pushRepo(item.dir, token);
        await dequeueRepo(item.dir);
        succeeded++;
      } catch {
        failed++;
      }
    }
    const remaining = await getQueue();
    set({ pendingPushCount: remaining.length });
    return { succeeded, failed };
  },
}));
