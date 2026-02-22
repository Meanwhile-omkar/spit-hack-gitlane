import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, StatusBar, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { useStore } from '../store/useStore';
import { initRepo, REPOS_DIR } from '../git/gitOps';

export default function HomeScreen({ navigation }) {
  const { repos, loadRepos, removeRepo, setActiveRepo, addRepo, creds } = useStore();

  // Create local repo modal
  const [showCreate, setShowCreate] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadRepos(); }, []);

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
      // Open it immediately
      navigation.navigate('RepoTabs', { dir: dirPath, name });
    } catch (e) {
      Alert.alert('Failed to create repo', e.message);
    } finally {
      setCreating(false);
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
          <Text style={s.emptySubtext}>Clone from GitHub or create a local repo</Text>
        </View>
      ) : (
        <FlatList
          data={[...repos].sort((a, b) => (b.lastOpened ?? 0) - (a.lastOpened ?? 0))}
          keyExtractor={r => r.dir}
          contentContainerStyle={{ paddingBottom: 130 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.repoCard}
              onPress={() => openRepo(item)}
              onLongPress={() => confirmDelete(item)}
            >
              <View style={s.repoIcon}>
                <Text style={s.repoIconText}>{item.url ? '📁' : '🗂️'}</Text>
              </View>
              <View style={s.repoInfo}>
                <Text style={s.repoName}>{item.name}</Text>
                <Text style={s.repoBranch} numberOfLines={1}>
                  {item.branch ? `  ${item.branch}` : ''}
                </Text>
                <Text style={s.repoUrl} numberOfLines={1}>
                  {item.url ?? '📴 local only'}
                </Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* FAB row: two buttons */}
      <View style={s.fabRow}>
        <TouchableOpacity
          style={[s.fab, s.fabLocal]}
          onPress={() => { setNewRepoName(''); setShowCreate(true); }}
        >
          <Text style={s.fabText}>🗂️  New Local</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.fab, s.fabClone]}
          onPress={() => navigation.navigate('Clone')}
        >
          <Text style={s.fabText}>⬇  Clone</Text>
        </TouchableOpacity>
      </View>

      {/* Create local repo modal */}
      <Modal visible={showCreate} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>New Local Repository</Text>
            <Text style={s.modalSub}>Works fully offline — share via Peer tab later</Text>
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
                style={[s.createBtn, creating && s.createBtnDim]}
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
  emptySubtext: { fontSize: 14, color: '#8b949e' },
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

  fabRow: {
    position: 'absolute', bottom: 24, left: 16, right: 16,
    flexDirection: 'row', gap: 10,
  },
  fab: {
    flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  fabLocal: { backgroundColor: '#1f6feb' },
  fabClone: { backgroundColor: '#238636' },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  overlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'center', padding: 28 },
  modal: {
    backgroundColor: '#161b22', borderRadius: 16, padding: 24,
    borderWidth: 1, borderColor: '#30363d',
  },
  modalTitle: { color: '#c9d1d9', fontSize: 17, fontWeight: '700', marginBottom: 4 },
  modalSub: { color: '#8b949e', fontSize: 12, marginBottom: 16 },
  modalInput: {
    backgroundColor: '#0d1117', borderWidth: 1, borderColor: '#30363d',
    borderRadius: 8, color: '#c9d1d9', padding: 12, fontSize: 15,
    fontFamily: 'monospace', marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: '#30363d', borderRadius: 8,
    paddingVertical: 12, alignItems: 'center',
  },
  cancelText: { color: '#8b949e', fontSize: 14 },
  createBtn: {
    flex: 1, backgroundColor: '#238636', borderRadius: 8,
    paddingVertical: 12, alignItems: 'center',
  },
  createBtnDim: { backgroundColor: '#1a3520' },
  createText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
