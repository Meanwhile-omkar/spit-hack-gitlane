import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, StatusBar, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { useStore } from '../store/useStore';
import { initRepo, cloneFromPeer, REPOS_DIR } from '../git/gitOps';

// Fetch with timeout — AbortSignal.timeout not in Hermes
async function fetchWithTimeout(url, ms = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return r;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

export default function HomeScreen({ navigation }) {
  const { repos, loadRepos, removeRepo, setActiveRepo, addRepo, creds } = useStore();

  // New local repo modal
  const [showCreate, setShowCreate] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [creating, setCreating] = useState(false);

  // Peer clone modal
  const [showPeerClone, setShowPeerClone] = useState(false);
  const [peerUrl, setPeerUrl] = useState('');
  const [peerInfo, setPeerInfo] = useState(null);  // { repoName }
  const [detecting, setDetecting] = useState(false);
  const [cloning, setCloning] = useState(false);
  const detectTimer = useRef(null);

  useEffect(() => { loadRepos(); }, []);

  // Auto-detect peer info when URL is typed in the modal
  useEffect(() => {
    if (!showPeerClone) return;
    if (detectTimer.current) clearTimeout(detectTimer.current);
    const url = peerUrl.trim();
    if (!url.startsWith('http')) { setPeerInfo(null); return; }
    setDetecting(true);
    detectTimer.current = setTimeout(async () => {
      try {
        const resp = await fetchWithTimeout(`${url}/api/health`);
        const data = await resp.json();
        setPeerInfo({ repoName: data.repoName || 'peer-repo' });
      } catch {
        setPeerInfo(null);
      } finally {
        setDetecting(false);
      }
    }, 700);
    return () => clearTimeout(detectTimer.current);
  }, [peerUrl, showPeerClone]);

  const openRepo = (repo) => {
    setActiveRepo(repo);
    navigation.navigate('RepoTabs', { dir: repo.dir, name: repo.name });
  };

  const confirmDelete = (repo) => {
    Alert.alert(
      'Remove Repository',
      `Remove "${repo.name}" from the list? (local files won't be deleted)`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeRepo(repo.dir) },
      ],
    );
  };

  // Create a new local repo (host workflow)
  const createLocalRepo = async () => {
    const name = newRepoName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const dirPath = `${REPOS_DIR}/${name}`;
      await initRepo(dirPath, name, creds.name || 'GitLane User', creds.email || 'user@gitlane.app');
      await addRepo({ dir: dirPath, name, url: null, branch: 'main' });
      setShowCreate(false);
      setNewRepoName('');
      navigation.navigate('RepoTabs', { dir: dirPath, name });
    } catch (e) {
      Alert.alert('Failed to create repo', e.message);
    } finally {
      setCreating(false);
    }
  };

  // Clone a repo from a peer (connect workflow)
  const doPeerClone = async () => {
    const url = peerUrl.trim();
    const name = peerInfo?.repoName || `peer-${Date.now()}`;
    setCloning(true);
    try {
      const { dir } = await cloneFromPeer(url, name);
      await addRepo({ dir, name, url: `peer:${url}` });
      setShowPeerClone(false);
      setPeerUrl('');
      setPeerInfo(null);
      navigation.navigate('RepoTabs', { dir, name });
    } catch (e) {
      Alert.alert('Clone failed', e.message);
    } finally {
      setCloning(false);
    }
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0d1117" />
      <View style={s.header}>
        <Text style={s.title}>GitLane</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <Text style={s.icon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {repos.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📂</Text>
          <Text style={s.emptyText}>No repositories yet</Text>
          <Text style={s.emptySubtext}>Clone from GitHub, create local, or join a peer</Text>
        </View>
      ) : (
        <FlatList
          data={[...repos].sort((a, b) => (b.lastOpened ?? 0) - (a.lastOpened ?? 0))}
          keyExtractor={r => r.dir}
          contentContainerStyle={{ paddingBottom: 150 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.repoCard}
              onPress={() => openRepo(item)}
              onLongPress={() => confirmDelete(item)}
            >
              <View style={s.repoIcon}>
                <Text style={s.repoIconText}>
                  {item.url?.startsWith('peer:') ? '📡' : item.url ? '📁' : '🗂️'}
                </Text>
              </View>
              <View style={s.repoInfo}>
                <Text style={s.repoName}>{item.name}</Text>
                <Text style={s.repoBranch} numberOfLines={1}>
                  {item.branch ? `  ${item.branch}` : ''}
                </Text>
                <Text style={s.repoUrl} numberOfLines={1}>
                  {item.url?.startsWith('peer:')
                    ? '📡 peer repo'
                    : item.url ?? '📴 local only'}
                </Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* 3-button FAB layout */}
      <View style={s.fabArea}>
        <TouchableOpacity
          style={[s.fab, s.fabClone]}
          onPress={() => navigation.navigate('Clone')}
        >
          <Text style={s.fabText}>⬇  Clone from GitHub</Text>
        </TouchableOpacity>
        <View style={s.fabRow}>
          <TouchableOpacity
            style={[s.fabHalf, s.fabLocal]}
            onPress={() => { setNewRepoName(''); setShowCreate(true); }}
          >
            <Text style={s.fabText}>🗂️  New Local</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.fabHalf, s.fabPeer]}
            onPress={() => { setPeerUrl(''); setPeerInfo(null); setShowPeerClone(true); }}
          >
            <Text style={s.fabText}>📡  Peer Clone</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── New local repo modal ─────────────────────────────────────────── */}
      <Modal visible={showCreate} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>🗂️  New Local Repository</Text>
            <Text style={s.modalSub}>
              Works fully offline. Share with peers later via the Peer tab.
            </Text>
            <TextInput
              style={s.modalInput}
              placeholder="repo-name"
              placeholderTextColor="#8b949e"
              value={newRepoName}
              onChangeText={setNewRepoName}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => setShowCreate(false)}
                disabled={creating}
              >
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.createBtn, (creating || !newRepoName.trim()) && s.createBtnDim]}
                onPress={createLocalRepo}
                disabled={creating || !newRepoName.trim()}
              >
                {creating
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.createText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Peer clone modal ─────────────────────────────────────────────── */}
      <Modal visible={showPeerClone} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>📡  Clone from Peer</Text>
            <Text style={s.modalSub}>
              Scan the QR on the host's screen with your camera app, then paste the URL below.
            </Text>
            <TextInput
              style={s.modalInput}
              placeholder="http://192.168.x.x:7821"
              placeholderTextColor="#8b949e"
              value={peerUrl}
              onChangeText={setPeerUrl}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            {/* Connection status */}
            {detecting && (
              <View style={s.detectRow}>
                <ActivityIndicator size="small" color="#58a6ff" />
                <Text style={s.detectText}>Reaching peer…</Text>
              </View>
            )}
            {!detecting && peerInfo && (
              <View style={s.peerOk}>
                <Text style={s.peerOkText}>✓  Found repo: "{peerInfo.repoName}"</Text>
              </View>
            )}
            {!detecting && !peerInfo && peerUrl.startsWith('http') && (
              <View style={s.peerFail}>
                <Text style={s.peerFailText}>✕  Could not reach peer — check the URL</Text>
              </View>
            )}

            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => setShowPeerClone(false)}
                disabled={cloning}
              >
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.createBtn, (!peerUrl.startsWith('http') || cloning) && s.createBtnDim]}
                onPress={doPeerClone}
                disabled={!peerUrl.startsWith('http') || cloning}
              >
                {cloning
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.createText}>
                      Clone{peerInfo ? ` "${peerInfo.repoName}"` : ''}
                    </Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#21262d',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#58a6ff' },
  icon: { fontSize: 22 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon: { fontSize: 56 },
  emptyText: { fontSize: 18, color: '#c9d1d9', fontWeight: '600' },
  emptySubtext: { fontSize: 13, color: '#8b949e', textAlign: 'center', paddingHorizontal: 24 },

  repoCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 10,
    backgroundColor: '#161b22', borderRadius: 10,
    padding: 14, borderWidth: 1, borderColor: '#21262d',
  },
  repoIcon: { marginRight: 12 },
  repoIconText: { fontSize: 28 },
  repoInfo: { flex: 1 },
  repoName: { fontSize: 16, fontWeight: '600', color: '#c9d1d9' },
  repoBranch: { fontSize: 12, color: '#3fb950', marginTop: 2 },
  repoUrl: { fontSize: 11, color: '#8b949e', marginTop: 2 },
  chevron: { fontSize: 24, color: '#8b949e' },

  fabArea: {
    position: 'absolute', bottom: 16, left: 16, right: 16, gap: 8,
  },
  fab: {
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  fabRow: { flexDirection: 'row', gap: 8 },
  fabHalf: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  fabClone: { backgroundColor: '#238636' },
  fabLocal: { backgroundColor: '#1f6feb' },
  fabPeer: { backgroundColor: '#6e40c9' },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  overlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'center', padding: 24 },
  modal: {
    backgroundColor: '#161b22', borderRadius: 16, padding: 22,
    borderWidth: 1, borderColor: '#30363d', gap: 10,
  },
  modalTitle: { color: '#c9d1d9', fontSize: 17, fontWeight: '700' },
  modalSub: { color: '#8b949e', fontSize: 12, lineHeight: 18 },
  modalInput: {
    backgroundColor: '#0d1117', borderWidth: 1, borderColor: '#30363d',
    borderRadius: 8, color: '#c9d1d9', padding: 12, fontSize: 14,
    fontFamily: 'monospace',
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: '#30363d', borderRadius: 8,
    paddingVertical: 12, alignItems: 'center',
  },
  cancelText: { color: '#8b949e', fontSize: 14 },
  createBtn: { flex: 1, backgroundColor: '#238636', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  createBtnDim: { backgroundColor: '#1a3520' },
  createText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  detectRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detectText: { color: '#58a6ff', fontSize: 13 },
  peerOk: {
    backgroundColor: '#132113', borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: '#3fb950',
  },
  peerOkText: { color: '#3fb950', fontWeight: '600', fontSize: 13 },
  peerFail: {
    backgroundColor: '#2d1a1a', borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: '#f78166',
  },
  peerFailText: { color: '#f78166', fontSize: 13 },
});
