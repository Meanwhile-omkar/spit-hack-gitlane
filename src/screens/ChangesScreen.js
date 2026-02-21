import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { getStatus, stageFile, unstageFile, stageAll, unstageAll, commit, diffFile } from '../git/gitOps';
import { useStore } from '../store/useStore';

const STATUS_COLOR = {
  'new': '#3fb950', 'staged-new': '#3fb950',
  'modified': '#d29922', 'staged-modified': '#d29922',
  'deleted': '#f78166', 'staged-deleted': '#f78166',
};
const STATUS_LABEL = {
  'new': 'U', 'staged-new': 'A',
  'modified': 'M', 'staged-modified': 'M',
  'deleted': 'D', 'staged-deleted': 'D',
};

export default function ChangesScreen({ route }) {
  const { dir } = route.params;
  const { creds } = useStore();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commitMsg, setCommitMsg] = useState('');
  const [committing, setCommitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [diffContent, setDiffContent] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = await getStatus(dir);
      setFiles(status);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [dir]);

  // Reload every time this tab becomes focused (e.g. after editing a file in Files tab)
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async (file) => {
    try {
      if (file.staged) await unstageFile(dir, file.path);
      else await stageFile(dir, file.path);
      load();
    } catch (e) { Alert.alert('Error', e.message); }
  };

  const viewDiff = async (file) => {
    setSelectedFile(file.path);
    const d = await diffFile(dir, file.path);
    setDiffContent(d || '(no diff available)');
  };

  const doCommit = async () => {
    const staged = files.filter(f => f.staged);
    if (!staged.length) { Alert.alert('Nothing staged', 'Stage some files first.'); return; }
    if (!commitMsg.trim()) { Alert.alert('No message', 'Enter a commit message.'); return; }
    const name = creds.name || 'GitLane User';
    const email = creds.email || 'user@gitlane.app';
    setCommitting(true);
    try {
      const sha = await commit(dir, commitMsg.trim(), name, email);
      Alert.alert('Committed', `SHA: ${sha.slice(0, 7)}`);
      setCommitMsg('');
      load();
    } catch (e) { Alert.alert('Commit failed', e.message); }
    finally { setCommitting(false); }
  };

  const staged = files.filter(f => f.staged);
  const unstaged = files.filter(f => !f.staged);

  if (loading) return <View style={s.center}><ActivityIndicator color="#58a6ff" size="large" /></View>;

  if (selectedFile) {
    return (
      <View style={s.container}>
        <TouchableOpacity style={s.backBtn} onPress={() => setSelectedFile(null)}>
          <Text style={s.backText}>← {selectedFile}</Text>
        </TouchableOpacity>
        <ScrollView style={s.diffScroll} horizontal>
          <ScrollView>
            <Text style={s.diffText}>{diffContent}</Text>
          </ScrollView>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Commit box */}
      <View style={s.commitBox}>
        <TextInput
          style={s.commitInput}
          placeholder="Commit message..."
          placeholderTextColor="#8b949e"
          value={commitMsg}
          onChangeText={setCommitMsg}
          multiline
        />
        <View style={s.commitActions}>
          <TouchableOpacity style={s.stageAllBtn} onPress={() => stageAll(dir).then(load)}>
            <Text style={s.stageAllText}>Stage All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.commitBtn, (!staged.length || !commitMsg.trim()) && s.commitBtnDis]}
            onPress={doCommit}
            disabled={committing || !staged.length || !commitMsg.trim()}
          >
            {committing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.commitBtnText}>Commit ({staged.length})</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* Staged files */}
      {staged.length > 0 && (
        <>
          <Text style={s.sectionHead}>Staged ({staged.length})</Text>
          {staged.map(f => <FileRow key={f.path} file={f} onToggle={toggle} onDiff={viewDiff} />)}
        </>
      )}

      {/* Unstaged files */}
      {unstaged.length > 0 && (
        <>
          <Text style={s.sectionHead}>Changes ({unstaged.length})</Text>
          {unstaged.map(f => <FileRow key={f.path} file={f} onToggle={toggle} onDiff={viewDiff} />)}
        </>
      )}

      {files.length === 0 && (
        <View style={s.center}>
          <Text style={s.clean}>✓  Working tree clean</Text>
        </View>
      )}
    </View>
  );
}

function FileRow({ file, onToggle, onDiff }) {
  const color = STATUS_COLOR[file.status] ?? '#8b949e';
  const label = STATUS_LABEL[file.status] ?? '?';
  return (
    <View style={s.fileRow}>
      <TouchableOpacity style={[s.badge, { borderColor: color }]} onPress={() => onToggle(file)}>
        <Text style={[s.badgeText, { color }]}>{label}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.filePath} onPress={() => onDiff(file)}>
        <Text style={s.fileText} numberOfLines={1}>{file.path}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  clean: { color: '#3fb950', fontSize: 16 },
  commitBox: {
    backgroundColor: '#161b22', borderBottomWidth: 1,
    borderBottomColor: '#21262d', padding: 12,
  },
  commitInput: {
    color: '#c9d1d9', borderWidth: 1, borderColor: '#30363d',
    borderRadius: 8, padding: 10, fontSize: 14, minHeight: 60,
    textAlignVertical: 'top',
  },
  commitActions: { flexDirection: 'row', marginTop: 8, gap: 8 },
  stageAllBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#30363d', alignItems: 'center',
  },
  stageAllText: { color: '#c9d1d9', fontSize: 13 },
  commitBtn: {
    flex: 2, backgroundColor: '#238636', paddingVertical: 10,
    borderRadius: 8, alignItems: 'center',
  },
  commitBtnDis: { backgroundColor: '#1a3520', opacity: 0.5 },
  commitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  sectionHead: {
    color: '#8b949e', fontSize: 12, fontWeight: '600',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#0d1117', textTransform: 'uppercase',
  },
  fileRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#161b22',
  },
  badge: {
    width: 22, height: 22, borderRadius: 4, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  filePath: { flex: 1 },
  fileText: { color: '#c9d1d9', fontSize: 13, fontFamily: 'monospace' },
  backBtn: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#21262d' },
  backText: { color: '#58a6ff', fontSize: 14 },
  diffScroll: { flex: 1 },
  diffText: { fontFamily: 'monospace', fontSize: 12, color: '#c9d1d9', padding: 12 },
});
