import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import QRCode from 'qrcode';
import { useFocusEffect } from '@react-navigation/native';
import { startServer, stopServer, isServerRunning } from '../services/peerServer';
import { fetchFromPeer, pushToPeer, cloneFromPeer } from '../git/gitOps';
import { useStore } from '../store/useStore';
import git from 'isomorphic-git';
import fs from '../git/fs-adapter';

const PORT = 7821;

// ── Pure-JS QR renderer (no native SVG needed) ─────────────────────────────
function QRDisplay({ value, size = 220 }) {
  const matrix = useMemo(() => {
    if (!value) return null;
    try {
      const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
      return qr.modules;
    } catch {
      return null;
    }
  }, [value]);

  if (!matrix) return null;
  const count = matrix.size;
  const cell = Math.floor((size - 16) / count);

  return (
    <View style={{ width: size, height: size, backgroundColor: '#fff', padding: 8, borderRadius: 8 }}>
      {Array.from({ length: count }, (_, row) => (
        <View key={row} style={{ flexDirection: 'row' }}>
          {Array.from({ length: count }, (_, col) => (
            <View
              key={col}
              style={{
                width: cell, height: cell,
                backgroundColor: matrix.data[row * count + col] === 1 ? '#000' : '#fff',
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────
export default function PeerScreen({ route }) {
  const { dir } = route.params;
  const { addRepo, creds } = useStore();
  const [mode, setMode] = useState('host'); // 'host' | 'connect'

  // Host state
  const [hosting, setHosting] = useState(false);
  const [localIP, setLocalIP] = useState('');
  const [events, setEvents] = useState([]);

  // Connect state
  const [peerUrl, setPeerUrl] = useState('');
  const [peerName, setPeerName] = useState('');
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [connStatus, setConnStatus] = useState(null); // null | 'ok' | 'fail'

  const [loading, setLoading] = useState('');

  const logEvent = useCallback(msg => {
    const time = new Date().toLocaleTimeString();
    setEvents(prev => [`${time}  ${msg}`, ...prev].slice(0, 30));
  }, []);

  // Sync hosting state on focus
  useFocusEffect(useCallback(() => {
    setHosting(isServerRunning());
  }, []));

  // Get local IP
  useEffect(() => {
    NetInfo.fetch().then(s => {
      const ip = s.details?.ipAddress;
      if (ip) setLocalIP(ip);
    });
  }, []);

  // Load branches for push picker
  useEffect(() => {
    if (mode === 'connect') {
      git.listBranches({ fs, dir }).then(b => {
        setBranches(b);
        if (b.length > 0) setSelectedBranch(b[0]);
      }).catch(() => {});
    }
  }, [mode, dir]);

  const serverUrl = localIP ? `http://${localIP}:${PORT}` : '';

  // ── HOST actions ──────────────────────────────────────────────────────────
  const toggleHost = () => {
    if (hosting) {
      stopServer();
      setHosting(false);
      logEvent('Server stopped');
    } else {
      startServer(dir, PORT, (event, data) => {
        if (event === 'listening') logEvent(`Listening on :${PORT}`);
        else if (event === 'connection') logEvent('New device connected');
        else if (event === 'push') logEvent(`Push received from peer`);
        else if (event === 'error') logEvent(`Error: ${data}`);
      });
      setHosting(true);
      logEvent(`Started server on port ${PORT}`);
    }
  };

  // ── CONNECT actions ───────────────────────────────────────────────────────
  const testConnection = async () => {
    const url = peerUrl.trim();
    if (!url) return;
    setLoading('test');
    try {
      const resp = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(5000) });
      const data = await resp.json();
      setConnStatus('ok');
      if (data.repoName) setPeerName(data.repoName);
      logEvent(`Connected to "${data.repoName}" on ${url}`);
    } catch (e) {
      setConnStatus('fail');
      logEvent(`Connection failed: ${e.message}`);
    } finally {
      setLoading('');
    }
  };

  const doClone = async () => {
    const url = peerUrl.trim();
    const name = peerName.trim() || `peer-repo-${Date.now()}`;
    setLoading('clone');
    try {
      const { dir: newDir } = await cloneFromPeer(url, name);
      await addRepo({ dir: newDir, name, url: `peer:${url}` });
      Alert.alert('Cloned!', `"${name}" is now available in your repo list.`);
      logEvent(`Cloned "${name}" from peer`);
    } catch (e) {
      Alert.alert('Clone failed', e.message);
    } finally {
      setLoading('');
    }
  };

  const doFetch = async () => {
    const url = peerUrl.trim();
    setLoading('fetch');
    try {
      const refs = await fetchFromPeer(dir, url);
      Alert.alert('Fetched!', `Got ${refs.length} branch(es) from peer.`);
      logEvent(`Fetched ${refs.length} branch(es)`);
    } catch (e) {
      Alert.alert('Fetch failed', e.message);
    } finally {
      setLoading('');
    }
  };

  const doPush = async () => {
    const url = peerUrl.trim();
    if (!selectedBranch) return;
    Alert.alert('Push to Peer', `Push "${selectedBranch}" to ${url}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Push',
        onPress: async () => {
          setLoading('push');
          try {
            await pushToPeer(dir, url, selectedBranch);
            Alert.alert('Pushed!', `Branch "${selectedBranch}" sent to peer.`);
            logEvent(`Pushed "${selectedBranch}" to peer`);
          } catch (e) {
            Alert.alert('Push failed', e.message);
          } finally {
            setLoading('');
          }
        },
      },
    ]);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={s.container}>
      {/* Mode toggle */}
      <View style={s.toggle}>
        <TouchableOpacity
          style={[s.toggleBtn, mode === 'host' && s.toggleActive]}
          onPress={() => setMode('host')}
        >
          <Text style={[s.toggleText, mode === 'host' && s.toggleActiveText]}>📡  Host</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.toggleBtn, mode === 'connect' && s.toggleActive]}
          onPress={() => setMode('connect')}
        >
          <Text style={[s.toggleText, mode === 'connect' && s.toggleActiveText]}>🔗  Connect</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {mode === 'host' ? (
          <HostView
            hosting={hosting}
            localIP={localIP}
            serverUrl={serverUrl}
            events={events}
            onToggle={toggleHost}
          />
        ) : (
          <ConnectView
            peerUrl={peerUrl}
            setPeerUrl={setPeerUrl}
            peerName={peerName}
            setPeerName={setPeerName}
            connStatus={connStatus}
            branches={branches}
            selectedBranch={selectedBranch}
            setSelectedBranch={setSelectedBranch}
            loading={loading}
            events={events}
            onTest={testConnection}
            onClone={doClone}
            onFetch={doFetch}
            onPush={doPush}
          />
        )}
      </ScrollView>
    </View>
  );
}

// ── Host sub-view ─────────────────────────────────────────────────────────
function HostView({ hosting, localIP, serverUrl, events, onToggle }) {
  return (
    <>
      {/* Status + toggle */}
      <View style={[s.statusCard, hosting ? s.statusOnline : s.statusOffline]}>
        <View style={[s.dot, { backgroundColor: hosting ? '#3fb950' : '#8b949e' }]} />
        <Text style={[s.statusText, { color: hosting ? '#3fb950' : '#8b949e' }]}>
          {hosting ? `Hosting on port 7821` : 'Not hosting'}
        </Text>
      </View>

      <TouchableOpacity
        style={[s.bigBtn, hosting ? s.btnStop : s.btnStart]}
        onPress={onToggle}
      >
        <Text style={s.bigBtnText}>{hosting ? '■  Stop Server' : '▶  Start Hosting'}</Text>
      </TouchableOpacity>

      {hosting && serverUrl ? (
        <>
          <Text style={s.sectionLabel}>Other devices connect to:</Text>
          <View style={s.ipBox}>
            <Text style={s.ipText} selectable>{serverUrl}</Text>
          </View>

          <View style={s.qrWrap}>
            <QRDisplay value={serverUrl} size={220} />
          </View>
          <Text style={s.qrHint}>Scan QR or type the address above in Connect mode</Text>
        </>
      ) : null}

      {events.length > 0 && (
        <>
          <Text style={s.sectionLabel}>Activity log</Text>
          <View style={s.logBox}>
            {events.map((e, i) => (
              <Text key={i} style={s.logLine}>{e}</Text>
            ))}
          </View>
        </>
      )}
    </>
  );
}

// ── Connect sub-view ──────────────────────────────────────────────────────
function ConnectView({
  peerUrl, setPeerUrl, peerName, setPeerName,
  connStatus, branches, selectedBranch, setSelectedBranch,
  loading, events, onTest, onClone, onFetch, onPush,
}) {
  return (
    <>
      <Text style={s.sectionLabel}>Peer server address</Text>
      <TextInput
        style={s.input}
        value={peerUrl}
        onChangeText={setPeerUrl}
        placeholder="http://192.168.x.x:7821"
        placeholderTextColor="#8b949e"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />

      <TouchableOpacity
        style={[s.btn, s.btnTest]}
        onPress={onTest}
        disabled={!!loading}
      >
        {loading === 'test'
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={s.btnText}>Test Connection</Text>}
      </TouchableOpacity>

      {connStatus && (
        <View style={[s.connBadge, connStatus === 'ok' ? s.connOk : s.connFail]}>
          <Text style={connStatus === 'ok' ? s.connOkText : s.connFailText}>
            {connStatus === 'ok' ? `✓  Connected${peerName ? ` — "${peerName}"` : ''}` : '✕  Could not connect'}
          </Text>
        </View>
      )}

      {/* Repo name for clone */}
      <Text style={s.sectionLabel}>Repo name (for clone)</Text>
      <TextInput
        style={s.input}
        value={peerName}
        onChangeText={setPeerName}
        placeholder="my-peer-repo"
        placeholderTextColor="#8b949e"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* Clone — gets repo as a new entry */}
      <TouchableOpacity
        style={[s.btn, s.btnClone]}
        onPress={onClone}
        disabled={!!loading || !peerUrl}
      >
        {loading === 'clone'
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={s.btnText}>⬇  Clone from Peer</Text>}
      </TouchableOpacity>

      {/* Fetch — pulls peer branches into current repo */}
      <TouchableOpacity
        style={[s.btn, s.btnFetch]}
        onPress={onFetch}
        disabled={!!loading || !peerUrl}
      >
        {loading === 'fetch'
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={s.btnText}>↓  Fetch into this repo</Text>}
      </TouchableOpacity>

      {/* Branch picker + push */}
      {branches.length > 0 && (
        <>
          <Text style={s.sectionLabel}>Push branch to peer</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.branchRow}>
            {branches.map(b => (
              <TouchableOpacity
                key={b}
                style={[s.branchChip, selectedBranch === b && s.branchChipActive]}
                onPress={() => setSelectedBranch(b)}
              >
                <Text style={[s.branchChipText, selectedBranch === b && s.branchChipTextActive]}>
                  {b}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={[s.btn, s.btnPush]}
            onPress={onPush}
            disabled={!!loading || !peerUrl || !selectedBranch}
          >
            {loading === 'push'
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.btnText}>↑  Push "{selectedBranch}"</Text>}
          </TouchableOpacity>
        </>
      )}

      {events.length > 0 && (
        <>
          <Text style={s.sectionLabel}>Activity log</Text>
          <View style={s.logBox}>
            {events.map((e, i) => (
              <Text key={i} style={s.logLine}>{e}</Text>
            ))}
          </View>
        </>
      )}
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },

  toggle: {
    flexDirection: 'row',
    backgroundColor: '#161b22',
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
  },
  toggleBtn: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  toggleActive: { borderBottomWidth: 2, borderBottomColor: '#58a6ff' },
  toggleText: { color: '#8b949e', fontWeight: '600', fontSize: 14 },
  toggleActiveText: { color: '#58a6ff' },

  content: { padding: 16, gap: 12, paddingBottom: 40 },

  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  statusOnline: { backgroundColor: '#132113', borderColor: '#3fb950' },
  statusOffline: { backgroundColor: '#161b22', borderColor: '#30363d' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontWeight: '700', fontSize: 13 },

  bigBtn: {
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  btnStart: { backgroundColor: '#238636' },
  btnStop: { backgroundColor: '#6e2020' },
  bigBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  sectionLabel: { color: '#8b949e', fontSize: 12, fontWeight: '600', marginTop: 4 },

  ipBox: {
    backgroundColor: '#161b22', borderRadius: 10, borderWidth: 1,
    borderColor: '#30363d', padding: 14, alignItems: 'center',
  },
  ipText: { color: '#58a6ff', fontSize: 16, fontFamily: 'monospace', fontWeight: '700' },

  qrWrap: { alignItems: 'center', paddingVertical: 8 },
  qrHint: { color: '#8b949e', fontSize: 11, textAlign: 'center' },

  logBox: {
    backgroundColor: '#0d1117', borderRadius: 8, borderWidth: 1,
    borderColor: '#21262d', padding: 10,
  },
  logLine: { color: '#8b949e', fontSize: 11, fontFamily: 'monospace', lineHeight: 18 },

  input: {
    backgroundColor: '#0d1117', borderWidth: 1, borderColor: '#30363d',
    borderRadius: 8, color: '#c9d1d9', padding: 12, fontSize: 14,
    fontFamily: 'monospace',
  },

  btn: {
    borderRadius: 10, paddingVertical: 13, alignItems: 'center',
  },
  btnTest: { backgroundColor: '#1f6feb' },
  btnClone: { backgroundColor: '#238636' },
  btnFetch: { backgroundColor: '#1a2d1a', borderWidth: 1, borderColor: '#3fb950' },
  btnPush: { backgroundColor: '#2d1f00', borderWidth: 1, borderColor: '#d29922' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  connBadge: {
    borderRadius: 8, padding: 10, borderWidth: 1,
  },
  connOk: { backgroundColor: '#132113', borderColor: '#3fb950' },
  connFail: { backgroundColor: '#2d1a1a', borderColor: '#f78166' },
  connOkText: { color: '#3fb950', fontWeight: '600', fontSize: 13 },
  connFailText: { color: '#f78166', fontWeight: '600', fontSize: 13 },

  branchRow: { marginBottom: 4 },
  branchChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#21262d', marginRight: 8, borderWidth: 1, borderColor: '#30363d',
  },
  branchChipActive: { backgroundColor: '#1c2a3a', borderColor: '#58a6ff' },
  branchChipText: { color: '#8b949e', fontSize: 12, fontWeight: '600' },
  branchChipTextActive: { color: '#58a6ff' },
});
