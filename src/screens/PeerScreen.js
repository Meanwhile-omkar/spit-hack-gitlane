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

// ── Fetch with manual timeout (AbortSignal.timeout not in Hermes) ──────────
async function fetchWithTimeout(url, options = {}, ms = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return resp;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ── Pure-JS QR renderer ────────────────────────────────────────────────────
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
  const { addRepo } = useStore();
  const [mode, setMode] = useState('host');

  // Host state
  const [hosting, setHosting] = useState(false);
  const [localIP, setLocalIP] = useState('');
  const [manualIP, setManualIP] = useState('');
  const [netType, setNetType] = useState('');
  const [events, setEvents] = useState([]);

  // Connect state
  const [peerUrl, setPeerUrl] = useState('');
  const [peerInfo, setPeerInfo] = useState(null); // { repoName } from health endpoint
  const [detecting, setDetecting] = useState(false);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [loading, setLoading] = useState('');
  const detectTimer = useRef(null);

  const logEvent = useCallback(msg => {
    const time = new Date().toLocaleTimeString();
    setEvents(prev => [`${time}  ${msg}`, ...prev].slice(0, 30));
  }, []);

  useFocusEffect(useCallback(() => {
    setHosting(isServerRunning());
  }, []));

  // Get local IP and detect network type
  useEffect(() => {
    NetInfo.fetch().then(s => {
      setNetType(s.type || '');
      const ip = s.details?.ipAddress;
      if (ip && s.type === 'wifi') {
        setLocalIP(ip);
      } else if (s.type === 'cellular' || !ip) {
        // On mobile data — no local WiFi IP
        // Common Android hotspot IP as fallback
        setLocalIP('');
      } else if (ip) {
        setLocalIP(ip);
      }
    });
  }, []);

  // Load branches for push
  useEffect(() => {
    if (mode === 'connect') {
      git.listBranches({ fs, dir }).then(b => {
        setBranches(b);
        if (b.length > 0) setSelectedBranch(b[0]);
      }).catch(() => {});
    }
  }, [mode, dir]);

  // Auto-detect peer repo when URL changes
  useEffect(() => {
    if (detectTimer.current) clearTimeout(detectTimer.current);
    const url = peerUrl.trim();
    if (!url.startsWith('http')) {
      setPeerInfo(null);
      return;
    }
    setDetecting(true);
    detectTimer.current = setTimeout(async () => {
      try {
        const resp = await fetchWithTimeout(`${url}/api/health`, {}, 4000);
        const data = await resp.json();
        setPeerInfo({ repoName: data.repoName || 'peer-repo' });
      } catch {
        setPeerInfo(null);
      } finally {
        setDetecting(false);
      }
    }, 800);
    return () => clearTimeout(detectTimer.current);
  }, [peerUrl]);

  const effectiveIP = manualIP.trim() || localIP;
  const serverUrl = effectiveIP ? `http://${effectiveIP}:${PORT}` : '';

  // ── HOST ──────────────────────────────────────────────────────────────────
  const toggleHost = () => {
    if (hosting) {
      stopServer();
      setHosting(false);
      logEvent('Server stopped');
    } else {
      startServer(dir, PORT, (event, data) => {
        if (event === 'listening') logEvent(`Listening on :${PORT}`);
        else if (event === 'connection') logEvent('New device connected');
        else if (event === 'push') logEvent('Push received from peer');
        else if (event === 'error') logEvent(`Error: ${data}`);
      });
      setHosting(true);
      logEvent(`Started — share ${serverUrl} with peer`);
    }
  };

  // ── CONNECT ───────────────────────────────────────────────────────────────
  const doClone = async () => {
    const url = peerUrl.trim();
    const name = (peerInfo?.repoName || `peer-${Date.now()}`);
    setLoading('clone');
    try {
      const { dir: newDir } = await cloneFromPeer(url, name);
      await addRepo({ dir: newDir, name, url: `peer:${url}` });
      Alert.alert('Cloned!', `"${name}" added to your repos.`);
      logEvent(`Cloned "${name}"`);
    } catch (e) {
      Alert.alert('Clone failed', e.message);
      logEvent(`Clone failed: ${e.message}`);
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
      logEvent(`Fetch failed: ${e.message}`);
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
            Alert.alert('Pushed!', `"${selectedBranch}" sent to peer.`);
            logEvent(`Pushed "${selectedBranch}"`);
          } catch (e) {
            Alert.alert('Push failed', e.message);
            logEvent(`Push failed: ${e.message}`);
          } finally {
            setLoading('');
          }
        },
      },
    ]);
  };

  return (
    <View style={s.container}>
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
            manualIP={manualIP}
            setManualIP={setManualIP}
            netType={netType}
            serverUrl={serverUrl}
            events={events}
            onToggle={toggleHost}
          />
        ) : (
          <ConnectView
            peerUrl={peerUrl}
            setPeerUrl={setPeerUrl}
            peerInfo={peerInfo}
            detecting={detecting}
            branches={branches}
            selectedBranch={selectedBranch}
            setSelectedBranch={setSelectedBranch}
            loading={loading}
            events={events}
            onClone={doClone}
            onFetch={doFetch}
            onPush={doPush}
          />
        )}
      </ScrollView>
    </View>
  );
}

// ── Host sub-view ──────────────────────────────────────────────────────────
function HostView({ hosting, localIP, manualIP, setManualIP, netType, serverUrl, events, onToggle }) {
  const onCellular = netType === 'cellular' && !localIP;

  return (
    <>
      {/* Network warning */}
      {onCellular && !manualIP && (
        <View style={s.warnCard}>
          <Text style={s.warnText}>
            📶  You're on mobile data — no local WiFi IP detected.{'\n'}
            To host, either:{'\n'}
            • Connect to the same WiFi as your peer, OR{'\n'}
            • Turn on Hotspot, then enter <Text style={s.mono}>192.168.43.1</Text> below
          </Text>
          <TouchableOpacity style={s.hotspotBtn} onPress={() => setManualIP('192.168.43.1')}>
            <Text style={s.hotspotBtnText}>Use Hotspot IP (192.168.43.1)</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Manual IP override */}
      <Text style={s.sectionLabel}>Your device IP{localIP ? ` (detected: ${localIP})` : ''}</Text>
      <TextInput
        style={s.input}
        value={manualIP || localIP}
        onChangeText={setManualIP}
        placeholder={localIP || '192.168.x.x'}
        placeholderTextColor="#8b949e"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
      />

      <View style={[s.statusCard, hosting ? s.statusOnline : s.statusOffline]}>
        <View style={[s.dot, { backgroundColor: hosting ? '#3fb950' : '#8b949e' }]} />
        <Text style={[s.statusText, { color: hosting ? '#3fb950' : '#8b949e' }]}>
          {hosting ? `Hosting on :${7821}` : 'Not hosting'}
        </Text>
      </View>

      <TouchableOpacity
        style={[s.bigBtn, hosting ? s.btnStop : s.btnStart]}
        onPress={onToggle}
        disabled={!serverUrl && !hosting}
      >
        <Text style={s.bigBtnText}>{hosting ? '■  Stop Server' : '▶  Start Hosting'}</Text>
      </TouchableOpacity>

      {hosting && serverUrl ? (
        <>
          <Text style={s.sectionLabel}>Share this address with your peer:</Text>
          <View style={s.ipBox}>
            <Text style={s.ipText} selectable>{serverUrl}</Text>
          </View>
          <View style={s.qrWrap}>
            <QRDisplay value={serverUrl} size={220} />
          </View>
          <Text style={s.qrHint}>Peer scans QR or types the address in Connect mode</Text>
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

// ── Connect sub-view ───────────────────────────────────────────────────────
function ConnectView({
  peerUrl, setPeerUrl, peerInfo, detecting,
  branches, selectedBranch, setSelectedBranch,
  loading, events, onClone, onFetch, onPush,
}) {
  const hasUrl = peerUrl.trim().startsWith('http');

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
      <Text style={s.hint}>
        💡 Use Google Lens / camera app to scan the QR on the host's screen, then paste the URL above.
      </Text>

      {/* Auto-detected peer info */}
      {detecting && (
        <View style={s.detectRow}>
          <ActivityIndicator size="small" color="#58a6ff" />
          <Text style={s.detectText}>Connecting…</Text>
        </View>
      )}
      {!detecting && peerInfo && (
        <View style={s.peerBadge}>
          <Text style={s.peerBadgeText}>✓  Connected — repo: "{peerInfo.repoName}"</Text>
        </View>
      )}
      {!detecting && !peerInfo && hasUrl && (
        <View style={s.peerBadgeFail}>
          <Text style={s.peerBadgeFailText}>✕  Could not reach peer</Text>
        </View>
      )}

      {/* Clone — creates new repo on this device */}
      <TouchableOpacity
        style={[s.btn, s.btnClone, (!hasUrl || !!loading) && s.btnDim]}
        onPress={onClone}
        disabled={!hasUrl || !!loading}
      >
        {loading === 'clone'
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={s.btnText}>
              ⬇  Clone{peerInfo ? ` "${peerInfo.repoName}"` : ' from Peer'}
            </Text>}
      </TouchableOpacity>

      {/* Fetch — updates THIS repo from peer */}
      <TouchableOpacity
        style={[s.btn, s.btnFetch, (!hasUrl || !!loading) && s.btnDim]}
        onPress={onFetch}
        disabled={!hasUrl || !!loading}
      >
        {loading === 'fetch'
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={s.btnText}>↓  Fetch into this repo</Text>}
      </TouchableOpacity>

      {/* Push */}
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
            style={[s.btn, s.btnPush, (!hasUrl || !selectedBranch || !!loading) && s.btnDim]}
            onPress={onPush}
            disabled={!hasUrl || !selectedBranch || !!loading}
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

// ── Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  toggle: {
    flexDirection: 'row', backgroundColor: '#161b22',
    borderBottomWidth: 1, borderBottomColor: '#21262d',
  },
  toggleBtn: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  toggleActive: { borderBottomWidth: 2, borderBottomColor: '#58a6ff' },
  toggleText: { color: '#8b949e', fontWeight: '600', fontSize: 14 },
  toggleActiveText: { color: '#58a6ff' },

  content: { padding: 16, gap: 10, paddingBottom: 40 },

  warnCard: {
    backgroundColor: '#2d1a00', borderRadius: 10, borderWidth: 1,
    borderColor: '#d29922', padding: 14,
  },
  warnText: { color: '#d29922', fontSize: 13, lineHeight: 20 },
  mono: { fontFamily: 'monospace', fontWeight: '700' },
  hotspotBtn: {
    marginTop: 10, backgroundColor: '#3a2500', borderRadius: 8,
    borderWidth: 1, borderColor: '#d29922', paddingVertical: 8, paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  hotspotBtnText: { color: '#d29922', fontSize: 12, fontWeight: '700' },

  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  statusOnline: { backgroundColor: '#132113', borderColor: '#3fb950' },
  statusOffline: { backgroundColor: '#161b22', borderColor: '#30363d' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontWeight: '700', fontSize: 13 },

  bigBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
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
  hint: { color: '#6e7681', fontSize: 11, lineHeight: 16 },

  detectRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  detectText: { color: '#58a6ff', fontSize: 13 },
  peerBadge: {
    backgroundColor: '#132113', borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: '#3fb950',
  },
  peerBadgeText: { color: '#3fb950', fontWeight: '600', fontSize: 13 },
  peerBadgeFail: {
    backgroundColor: '#2d1a1a', borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: '#f78166',
  },
  peerBadgeFailText: { color: '#f78166', fontWeight: '600', fontSize: 13 },

  btn: { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnDim: { opacity: 0.4 },
  btnClone: { backgroundColor: '#238636' },
  btnFetch: { backgroundColor: '#1a2d1a', borderWidth: 1, borderColor: '#3fb950' },
  btnPush: { backgroundColor: '#2d1f00', borderWidth: 1, borderColor: '#d29922' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  branchRow: { marginBottom: 4 },
  branchChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#21262d', marginRight: 8, borderWidth: 1, borderColor: '#30363d',
  },
  branchChipActive: { backgroundColor: '#1c2a3a', borderColor: '#58a6ff' },
  branchChipText: { color: '#8b949e', fontSize: 12, fontWeight: '600' },
  branchChipTextActive: { color: '#58a6ff' },
});
