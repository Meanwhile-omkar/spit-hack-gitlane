import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { fetchRepo, pullRepo, pushRepo, fetchFromPeer, pushToPeer, getCurrentBranch } from '../git/gitOps';
import { useStore } from '../store/useStore';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Icon } from '../components/Icon';

export default function RemoteScreen({ route }) {
  const { dir } = route.params;
  const { creds, queuePush, pendingPushCount, flushPushQueue, repos } = useStore();
  const { isOnline } = useNetworkStatus();
  const [fetchStatus, setFetchStatus] = useState(null);
  const [loading, setLoading] = useState('');

  // Detect peer-synced repos (url stored as "peer:http://...")
  const thisRepo = repos.find(r => r.dir === dir);
  const isPeer = !!thisRepo?.url?.startsWith('peer:');
  const peerUrl = isPeer ? thisRepo.url.slice(5) : null; // strip "peer:" prefix

  const run = async (label, fn) => {
    setLoading(label);
    setFetchStatus(null);
    try {
      await fn();
      setFetchStatus({ ok: true, msg: `${label} successful` });
    } catch (e) {
      setFetchStatus({ ok: false, msg: e.message ?? String(e) });
    } finally {
      setLoading('');
    }
  };

  const token = creds.token || null;
  const name = creds.name || 'GitLane User';
  const email = creds.email || 'user@gitlane.app';

  const handleFetch = () => {
    if (isPeer) {
      run('Fetch', () => fetchFromPeer(dir, peerUrl));
    } else {
      run('Fetch', () => fetchRepo(dir, token));
    }
  };

  const handlePull = () => {
    if (isPeer) {
      // fetchFromPeer updates refs + checks out working tree — equivalent to pull
      run('Pull', () => fetchFromPeer(dir, peerUrl));
    } else {
      run('Pull', () => pullRepo(dir, name, email, token));
    }
  };

  const handlePush = () => {
    if (isPeer) {
      Alert.alert('Push to Peer', 'Make sure the host device has their server running, then push?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Push',
          onPress: () => run('Push', async () => {
            const branch = await getCurrentBranch(dir);
            await pushToPeer(dir, peerUrl, branch);
          }),
        },
      ]);
      return;
    }
    if (!isOnline) {
      // Queue for later
      const repoName = dir.split('/').pop();
      queuePush(dir, repoName);
      setFetchStatus({ ok: true, msg: `Push queued — will sync when online` });
      return;
    }
    Alert.alert('Push', 'Push commits to origin?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Push', onPress: () => run('Push', () => pushRepo(dir, token)) },
    ]);
  };

  const handleFlush = async () => {
    setLoading('Syncing');
    setFetchStatus(null);
    try {
      const { succeeded, failed } = await flushPushQueue();
      if (failed === 0) {
        setFetchStatus({ ok: true, msg: `Synced ${succeeded} repo${succeeded !== 1 ? 's' : ''}` });
      } else {
        setFetchStatus({ ok: false, msg: `${succeeded} pushed, ${failed} failed — check logs` });
      }
    } finally {
      setLoading('');
    }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.heading}>Remote Operations</Text>

      {/* Connection status pill */}
      <View style={[s.statusPill, isOnline ? s.pillOnline : s.pillOffline]}>
        <View style={[s.dot, isOnline ? s.dotOnline : s.dotOffline]} />
        <Text style={[s.pillText, isOnline ? s.pillTextOnline : s.pillTextOffline]}>
          {isOnline ? 'Online' : 'Offline — remote ops unavailable'}
        </Text>
      </View>

      {!token && isOnline && !isPeer && (
        <View style={s.warn}>
          <View style={s.warnRow}>
            <Icon name="close" size={16} color="#d29922" />
            <Text style={s.warnText}>  No PAT token set in Settings. Push/pull to private repos will fail.</Text>
          </View>
        </View>
      )}

      {/* Pending pushes banner */}
      {pendingPushCount > 0 && (
        <TouchableOpacity
          style={s.queueBanner}
          onPress={isOnline ? handleFlush : undefined}
          disabled={!isOnline || loading === 'Syncing'}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.queueTitle}>
              {pendingPushCount} push{pendingPushCount !== 1 ? 'es' : ''} queued
            </Text>
            <Text style={s.queueSub}>
              {isOnline ? 'Tap to sync now' : 'Will auto-sync when online'}
            </Text>
          </View>
          {loading === 'Syncing'
            ? <ActivityIndicator color="#58a6ff" />
            : isOnline
              ? <Text style={s.syncBtn}>Sync ↑</Text>
              : null}
        </TouchableOpacity>
      )}

      <ActionCard
        title="Fetch"
        description={isPeer ? 'Download latest commits from peer device' : 'Download remote refs without merging'}
        iconName="download"
        loading={loading === 'Fetch'}
        disabled={!isPeer && !isOnline}
        onPress={handleFetch}
      />
      <ActionCard
        title="Pull"
        description={isPeer ? 'Fetch + apply changes from peer device' : 'Fetch + merge remote changes'}
        iconName="download"
        loading={loading === 'Pull'}
        disabled={!isPeer && !isOnline}
        onPress={handlePull}
      />
      <ActionCard
        title="Push"
        description={isPeer ? 'Send local commits to peer device' : isOnline ? 'Upload local commits to remote' : 'Queue push — will send when online'}
        iconName="download"
        loading={loading === 'Push'}
        disabled={false}
        onPress={handlePush}
        offline={!isPeer && !isOnline}
      />

      {fetchStatus && (
        <View style={[s.status, fetchStatus.ok ? s.statusOk : s.statusErr]}>
          <View style={s.statusRow}>
            <Icon name={fetchStatus.ok ? 'check' : 'close'} size={16} color={fetchStatus.ok ? '#3fb950' : '#f78166'} />
            <Text style={[s.statusText, fetchStatus.ok ? s.statusOkText : s.statusErrText]}>
              {fetchStatus.msg}
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function ActionCard({ title, description, iconName, loading, disabled, onPress, offline }) {
  return (
    <TouchableOpacity
      style={[s.card, disabled && !offline && s.cardDisabled]}
      onPress={onPress}
      disabled={!!loading || (disabled && !offline)}
    >
      <Icon name={iconName} size={24} color={disabled && !offline ? '#3d444d' : '#58a6ff'} />
      <View style={{ flex: 1 }}>
        <Text style={[s.cardTitle, disabled && !offline && s.dimText]}>{title}</Text>
        <Text style={s.cardDesc}>{description}</Text>
      </View>
      {loading
        ? <ActivityIndicator color="#58a6ff" />
        : offline
          ? <Text style={s.queueTag}>Queue</Text>
          : disabled
            ? <Text style={[s.chevron, s.dimText]}>—</Text>
            : <Text style={s.chevron}>›</Text>}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  content: { padding: 16, gap: 12 },
  heading: { fontSize: 18, fontWeight: '700', color: '#c9d1d9', marginBottom: 4 },

  statusPill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    gap: 7, marginBottom: 4,
  },
  pillOnline: { backgroundColor: '#1a2d1a', borderWidth: 1, borderColor: '#3fb950' },
  pillOffline: { backgroundColor: '#2d1a00', borderWidth: 1, borderColor: '#d29922' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOnline: { backgroundColor: '#3fb950' },
  dotOffline: { backgroundColor: '#d29922' },
  pillText: { fontSize: 12, fontWeight: '600' },
  pillTextOnline: { color: '#3fb950' },
  pillTextOffline: { color: '#d29922' },

  warn: {
    backgroundColor: '#2d1a00', borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: '#d29922',
  },
  warnRow: { flexDirection: 'row', alignItems: 'center' },
  warnText: { color: '#d29922', fontSize: 13 },

  queueBanner: {
    backgroundColor: '#1c2a3a', borderRadius: 10, borderWidth: 1,
    borderColor: '#58a6ff', padding: 14, flexDirection: 'row',
    alignItems: 'center', gap: 10,
  },
  queueTitle: { color: '#58a6ff', fontWeight: '700', fontSize: 14 },
  queueSub: { color: '#8b949e', fontSize: 12, marginTop: 2 },
  syncBtn: { color: '#58a6ff', fontWeight: '700', fontSize: 14 },

  card: {
    backgroundColor: '#161b22', borderRadius: 12,
    borderWidth: 1, borderColor: '#21262d',
    padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  cardDisabled: { opacity: 0.45 },
  cardIcon: { fontSize: 24, width: 32, textAlign: 'center' },
  cardTitle: { color: '#c9d1d9', fontSize: 16, fontWeight: '600' },
  cardDesc: { color: '#8b949e', fontSize: 13, marginTop: 2 },
  chevron: { fontSize: 24, color: '#8b949e' },
  dimText: { color: '#3d444d' },
  queueTag: {
    backgroundColor: '#1c2a3a', borderRadius: 6, paddingHorizontal: 8,
    paddingVertical: 3, color: '#58a6ff', fontSize: 12, fontWeight: '700',
    borderWidth: 1, borderColor: '#58a6ff',
  },

  status: { borderRadius: 10, padding: 14, marginTop: 4 },
  statusOk: { backgroundColor: '#1a2d1a', borderWidth: 1, borderColor: '#3fb950' },
  statusErr: { backgroundColor: '#2d1a1a', borderWidth: 1, borderColor: '#f78166' },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusText: { fontSize: 14, marginLeft: 8 },
  statusOkText: { color: '#3fb950' },
  statusErrText: { color: '#f78166' },
});
