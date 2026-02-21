import React, { useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, StatusBar, Alert,
} from 'react-native';
import { useStore } from '../store/useStore';

export default function HomeScreen({ navigation }) {
  const { repos, loadRepos, removeRepo, setActiveRepo } = useStore();

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
          <Text style={s.emptySubtext}>Clone a repo to get started</Text>
        </View>
      ) : (
        <FlatList
          data={[...repos].sort((a, b) => (b.lastOpened ?? 0) - (a.lastOpened ?? 0))}
          keyExtractor={r => r.dir}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.repoCard}
              onPress={() => openRepo(item)}
              onLongPress={() => confirmDelete(item)}
            >
              <View style={s.repoIcon}><Text style={s.repoIconText}>📁</Text></View>
              <View style={s.repoInfo}>
                <Text style={s.repoName}>{item.name}</Text>
                <Text style={s.repoBranch} numberOfLines={1}>
                  {item.branch ? `  ${item.branch}` : ''}
                </Text>
                <Text style={s.repoUrl} numberOfLines={1}>{item.url ?? item.dir}</Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={s.fab} onPress={() => navigation.navigate('Clone')}>
        <Text style={s.fabText}>＋  Clone Repo</Text>
      </TouchableOpacity>
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
  fab: {
    position: 'absolute', bottom: 24, left: 24, right: 24,
    backgroundColor: '#238636', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
