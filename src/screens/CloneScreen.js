import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { cloneRepo } from '../git/gitOps';
import { useStore } from '../store/useStore';
import { Icon } from '../components/Icon';

export default function CloneScreen({ navigation }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const { creds, addRepo, setCloneProgress } = useStore();

  const deriveRepoName = (rawUrl) => {
    const parts = rawUrl.trim().split('/');
    return parts[parts.length - 1].replace(/\.git$/, '') || 'repo';
  };

  const onUrlChange = (val) => {
    setUrl(val);
    if (!name) setName(deriveRepoName(val));
  };

  const handleClone = async () => {
    const trimUrl = url.trim();
    const trimName = (name.trim() || deriveRepoName(trimUrl));
    if (!trimUrl) { Alert.alert('Error', 'Enter a repository URL'); return; }

    setLoading(true);
    setProgress({ phase: 'Preparing...', loaded: 0, total: 0 });

    try {
      const repo = await cloneRepo(trimUrl, trimName, creds.token || null, (p) => {
        setProgress(p);
        setCloneProgress(p);
      });
      await addRepo({ ...repo, branch: 'main', url: trimUrl });
      setCloneProgress(null);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Clone Failed', e.message ?? String(e));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const pct = progress?.total > 0
    ? Math.round((progress.loaded / progress.total) * 100)
    : null;

  return (
    <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
      <Text style={s.heading}>Clone Repository</Text>

      <Text style={s.label}>Repository URL</Text>
      <TextInput
        style={s.input}
        placeholder="https://github.com/user/repo.git"
        placeholderTextColor="#8b949e"
        value={url}
        onChangeText={onUrlChange}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />

      <Text style={s.label}>Local Name</Text>
      <TextInput
        style={s.input}
        placeholder="my-repo"
        placeholderTextColor="#8b949e"
        value={name}
        onChangeText={setName}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {creds.token ? (
        <View style={s.tokenBadge}>
          <View style={s.tokenBadgeRow}>
            <Icon name="check" size={16} color="#3fb950" />
            <Text style={s.tokenText}>  Using saved PAT token</Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={s.tokenHint} onPress={() => navigation.navigate('Settings')}>
          <View style={s.tokenHintRow}>
            <Icon name="close" size={16} color="#d29922" />
            <Text style={s.tokenHintText}>  No token set — private repos will fail. Tap to add →</Text>
          </View>
        </TouchableOpacity>
      )}

      {loading && (
        <View style={s.progressBox}>
          <ActivityIndicator color="#58a6ff" />
          <Text style={s.progressPhase}>{progress?.phase ?? 'Working...'}</Text>
          {pct !== null && (
            <>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${pct}%` }]} />
              </View>
              <Text style={s.progressPct}>{pct}%</Text>
            </>
          )}
        </View>
      )}

      <TouchableOpacity
        style={[s.btn, loading && s.btnDisabled]}
        onPress={handleClone}
        disabled={loading}
      >
        <Icon name="download" size={18} color="#fff" />
        <Text style={s.btnText}>  {loading ? 'Cloning...' : 'Clone'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', padding: 20 },
  heading: { fontSize: 20, fontWeight: '700', color: '#c9d1d9', marginBottom: 24 },
  label: { fontSize: 13, color: '#8b949e', marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: '#161b22', borderWidth: 1, borderColor: '#30363d',
    borderRadius: 8, color: '#c9d1d9', padding: 12, fontSize: 15,
  },
  tokenBadge: {
    marginTop: 16, backgroundColor: '#1a2d1a', borderRadius: 8,
    padding: 10, borderWidth: 1, borderColor: '#3fb950',
  },
  tokenBadgeRow: { flexDirection: 'row', alignItems: 'center' },
  tokenText: { color: '#3fb950', fontSize: 13 },
  tokenHint: {
    marginTop: 16, backgroundColor: '#2d1a00', borderRadius: 8,
    padding: 10, borderWidth: 1, borderColor: '#d29922',
  },
  tokenHintRow: { flexDirection: 'row', alignItems: 'center' },
  tokenHintText: { color: '#d29922', fontSize: 12 },
  progressBox: {
    marginTop: 20, backgroundColor: '#161b22', borderRadius: 10,
    padding: 16, alignItems: 'center', gap: 8,
  },
  progressPhase: { color: '#8b949e', fontSize: 13 },
  progressTrack: {
    width: '100%', height: 6, backgroundColor: '#21262d', borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#58a6ff', borderRadius: 3 },
  progressPct: { color: '#58a6ff', fontSize: 13, fontWeight: '600' },
  btn: {
    marginTop: 28, backgroundColor: '#238636', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  btnDisabled: { backgroundColor: '#1a3520', opacity: 0.7 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
