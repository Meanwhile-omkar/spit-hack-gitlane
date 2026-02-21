import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'gitlane_push_queue';

/**
 * Persistent push queue backed by AsyncStorage.
 * Each item: { id, dir, repoName, queuedAt }
 * Token is intentionally NOT stored — read from store at flush time.
 */

export async function enqueueRepo(dir, repoName) {
  const queue = await getQueue();
  // Deduplicate by dir — no point queuing the same repo twice
  if (queue.find(item => item.dir === dir)) return;
  queue.push({ id: Date.now().toString(), dir, repoName, queuedAt: Date.now() });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function dequeueRepo(dir) {
  const queue = await getQueue();
  const updated = queue.filter(item => item.dir !== dir);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
  return updated;
}

export async function getQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearQueue() {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
