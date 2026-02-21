import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { fetchRepo, pullRepo, pushRepo } from '../git/gitOps';
import { useStore } from '../store/useStore';

export default function RemoteScreen({ route }) {
  const { dir } = route.params;
  const { creds } = useStore();
  const [fetchStatus, setFetchStatus] = useState(null);
  const [loading, setLoading] = useState('');

  const run = async (label, fn) => {
    setLoading(label);
    setFetchStatus(null);
    try {
      const result = await fn();
      setFetchStatus({ ok: true, msg: result ?? `${label} successful` });
    } catch (e) {
      setFetchStatus({ ok: false, msg: e.message ?? String(e) });
    } finally {
      setLoading('');
    }
  };

  const token = creds.token || null;
  const name = creds.name || 'GitLane User';
  const email = creds.email || 'user@gitlane.app';

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.heading}>Remote Operations</Text>
      {!token && (
        <View style={s.warn}>
          <Text style={s.warnText}>⚠️  No PAT token set in Settings. Push/pull to private repos will fail.</Text>
        </View>
      )}

      <ActionCard
        title="Fetch"
        description="Download remote refs without merging"
        icon="⬇"
        loading={loading === 'Fetch'}
        onPress={() => run('Fetch', () => fetchRepo(dir, token))}
      />
      <ActionCard
        title="Pull"
        description="Fetch + merge remote changes"
        icon="⬆⬇"
        loading={loading === 'Pull'}
        onPress={() => run('Pull', () => pullRepo(dir, name, email, token))}
      />
      <ActionCard
        title="Push"
        description="Upload local commits to remote"
        icon="⬆"
        loading={loading === 'Push'}
        onPress={() => {
          Alert.alert('Push', 'Push commits to origin?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Push', onPress: () => run('Push', () => pushRepo(dir, token)) },
          ]);
        }}
      />

      {fetchStatus && (
        <View style={[s.status, fetchStatus.ok ? s.statusOk : s.statusErr]}>
          <Text style={[s.statusText, fetchStatus.ok ? s.statusOkText : s.statusErrText]}>
            {fetchStatus.ok ? '✓  ' : '✕  '}{fetchStatus.msg}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function ActionCard({ title, description, icon, loading, onPress }) {
  return (
    <TouchableOpacity style={s.card} onPress={onPress} disabled={!!loading}>
      <Text style={s.cardIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.cardTitle}>{title}</Text>
        <Text style={s.cardDesc}>{description}</Text>
      </View>
      {loading
        ? <ActivityIndicator color="#58a6ff" />
        : <Text style={s.chevron}>›</Text>}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  content: { padding: 16, gap: 12 },
  heading: { fontSize: 18, fontWeight: '700', color: '#c9d1d9', marginBottom: 8 },
  warn: {
    backgroundColor: '#2d1a00', borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: '#d29922', marginBottom: 8,
  },
  warnText: { color: '#d29922', fontSize: 13 },
  card: {
    backgroundColor: '#161b22', borderRadius: 12,
    borderWidth: 1, borderColor: '#21262d',
    padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  cardIcon: { fontSize: 24, width: 32, textAlign: 'center' },
  cardTitle: { color: '#c9d1d9', fontSize: 16, fontWeight: '600' },
  cardDesc: { color: '#8b949e', fontSize: 13, marginTop: 2 },
  chevron: { fontSize: 24, color: '#8b949e' },
  status: { borderRadius: 10, padding: 14, marginTop: 8 },
  statusOk: { backgroundColor: '#1a2d1a', borderWidth: 1, borderColor: '#3fb950' },
  statusErr: { backgroundColor: '#2d1a1a', borderWidth: 1, borderColor: '#f78166' },
  statusText: { fontSize: 14 },
  statusOkText: { color: '#3fb950' },
  statusErrText: { color: '#f78166' },
});
