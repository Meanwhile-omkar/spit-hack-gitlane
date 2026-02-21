import React, { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, ScrollView, RefreshControl,
} from 'react-native';
import { getStatus, stageFile, unstageFile, stageAll, unstageAll, commit, diffFile } from '../git/gitOps';
import { useStore } from '../store/useStore';

const LABEL = {
  'new': 'U', 'staged-new': 'A',
  'modified': 'M', 'staged-modified': 'M',
  'deleted': 'D', 'staged-deleted': 'D',
};
const COLOR = {
  'new': '#3fb950', 'staged-new': '#3fb950',
  'modified': '#d29922', 'staged-modified': '#d29922',
  'deleted': '#f78166', 'staged-deleted': '#f78166',
};

/** Compute new status string after staging/unstaging */
function flipStatus(status, toStaged) {
  if (toStaged) {
    if (status === 'new')      return 'staged-new';
    if (status === 'modified') return 'staged-modified';
    if (status === 'deleted')  return 'staged-deleted';
  } else {
    if (status === 'staged-new')      return 'new';
    if (status === 'staged-modified') return 'modified';
    if (status === 'staged-deleted')  return 'deleted';
  }
  return status;
}

export default function ChangesScreen({ route }) {
  const { dir } = route.params;
  const { creds } = useStore();

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [committing, setCommitting] = useState(false);
  const [diffView, setDiffView] = useState(null); // { path, content }

  const loaded = useRef(false);

  const fetchStatus = useCallback(async () => {
    try {
      const status = await getStatus(dir);
      setFiles(status);
    } catch (e) {
      Alert.alert('Status error', e.message);
    }
  }, [dir]);

  // Load once on first focus; after that user pulls to refresh
  useFocusEffect(useCallback(() => {
    if (!loaded.current) {
      loaded.current = true;
      setLoading(true);
      fetchStatus().finally(() => setLoading(false));
    }
  }, [fetchStatus]));

  const pullRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStatus();
    setRefreshing(false);
  }, [fetchStatus]);

  // ── Optimistic toggle ──────────────────────────────────────────────────────
  const toggle = async (file) => {
    const toStaged = !file.staged;
    // Update UI immediately
    setFiles(prev => prev.map(f =>
      f.path !== file.path ? f : { ...f, staged: toStaged, status: flipStatus(f.status, toStaged) }
    ));
    try {
      if (file.staged) await unstageFile(dir, file.path);
      else             await stageFile(dir, file.path);
    } catch (e) {
      Alert.alert('Error', e.message);
      // Revert on failure
      setFiles(prev => prev.map(f =>
        f.path !== file.path ? f : { ...f, staged: file.staged, status: file.status }
      ));
    }
  };

  // ── Optimistic Stage All ───────────────────────────────────────────────────
  const doStageAll = async () => {
    setFiles(prev => prev.map(f =>
      f.staged ? f : { ...f, staged: true, status: flipStatus(f.status, true) }
    ));
    try {
      await stageAll(dir);
    } catch (e) {
      Alert.alert('Stage All failed', e.message);
      await fetchStatus(); // revert to real state
    }
  };

  // ── Optimistic Unstage All ─────────────────────────────────────────────────
  const doUnstageAll = async () => {
    setFiles(prev => prev.map(f =>
      !f.staged ? f : { ...f, staged: false, status: flipStatus(f.status, false) }
    ));
    try {
      await unstageAll(dir);
    } catch (e) {
      Alert.alert('Unstage All failed', e.message);
      await fetchStatus();
    }
  };

  // ── Diff view ──────────────────────────────────────────────────────────────
  const viewDiff = async (file) => {
    try {
      const content = await diffFile(dir, file.path);
      setDiffView({ path: file.path, content: content || '(no diff available)' });
    } catch (e) {
      setDiffView({ path: file.path, content: '(error loading diff)' });
    }
  };

  // ── Commit ─────────────────────────────────────────────────────────────────
  const doCommit = async () => {
    const staged = files.filter(f => f.staged);
    if (!staged.length)      { Alert.alert('Nothing staged', 'Tap a file badge to stage it first.'); return; }
    if (!commitMsg.trim())   { Alert.alert('No message', 'Enter a commit message.'); return; }
    const name  = creds.name  || 'GitLane User';
    const email = creds.email || 'user@gitlane.app';
    setCommitting(true);
    try {
      const sha = await commit(dir, commitMsg.trim(), name, email);
      Alert.alert('Committed ✓', `SHA: ${sha.slice(0, 7)}\n\nGo to Remote tab to push.`);
      setCommitMsg('');
      // Reload after commit
      loaded.current = false;
      setLoading(true);
      fetchStatus().finally(() => setLoading(false));
    } catch (e) {
      Alert.alert('Commit failed', e.message);
    } finally {
      setCommitting(false);
    }
  };

  const staged   = files.filter(f => f.staged);
  const unstaged = files.filter(f => !f.staged);

  // ── Diff screen ────────────────────────────────────────────────────────────
  if (diffView) {
    return (
      <View style={s.container}>
        <TouchableOpacity style={s.backBtn} onPress={() => setDiffView(null)}>
          <Text style={s.backText} numberOfLines={1}>← {diffView.path}</Text>
        </TouchableOpacity>
        <ScrollView horizontal>
          <ScrollView>
            <Text style={s.diffText}>{diffView.content}</Text>
          </ScrollView>
        </ScrollView>
      </View>
    );
  }

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color="#58a6ff" size="large" />
        <Text style={s.loadingHint}>Scanning working tree…</Text>
        <Text style={s.loadingSubHint}>(pull to refresh anytime)</Text>
      </View>
    );
  }

  // ── Main view ──────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={s.container}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={pullRefresh} tintColor="#58a6ff" />
      }
    >
      {/* ── Commit panel ── */}
      <View style={s.commitBox}>
        <TextInput
          style={s.commitInput}
          placeholder="Commit message..."
          placeholderTextColor="#8b949e"
          value={commitMsg}
          onChangeText={setCommitMsg}
          multiline
        />

        <View style={s.actions}>
          <TouchableOpacity style={s.stageAllBtn} onPress={doStageAll}>
            <Text style={s.stageAllText}>Stage All</Text>
          </TouchableOpacity>

          {staged.length > 0 && (
            <TouchableOpacity style={s.unstageAllBtn} onPress={doUnstageAll}>
              <Text style={s.unstageAllText}>Unstage All</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[s.commitBtn, (!staged.length || !commitMsg.trim() || committing) && s.commitBtnOff]}
            onPress={doCommit}
            disabled={committing || !staged.length || !commitMsg.trim()}
          >
            {committing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.commitBtnText}>Commit ({staged.length})</Text>}
          </TouchableOpacity>
        </View>

        {staged.length > 0 && (
          <Text style={s.stagedHint}>{staged.length} file{staged.length > 1 ? 's' : ''} staged · type a message and commit</Text>
        )}
      </View>

      {/* ── Empty state ── */}
      {files.length === 0 && (
        <View style={s.cleanBox}>
          <Text style={s.cleanIcon}>✓</Text>
          <Text style={s.cleanText}>Working tree clean</Text>
          <Text style={s.cleanSub}>Pull down to refresh</Text>
        </View>
      )}

      {/* ── Staged files ── */}
      {staged.length > 0 && (
        <>
          <Text style={s.sectionHead}>STAGED  ({staged.length})</Text>
          {staged.map(f => <FileRow key={f.path} file={f} onToggle={toggle} onDiff={viewDiff} />)}
        </>
      )}

      {/* ── Unstaged files ── */}
      {unstaged.length > 0 && (
        <>
          <Text style={s.sectionHead}>CHANGES  ({unstaged.length})</Text>
          {unstaged.map(f => <FileRow key={f.path} file={f} onToggle={toggle} onDiff={viewDiff} />)}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function FileRow({ file, onToggle, onDiff }) {
  const color = COLOR[file.status] ?? '#8b949e';
  const label = LABEL[file.status] ?? '?';
  return (
    <View style={[s.fileRow, file.staged && s.fileRowStaged]}>
      {/* Badge — tap to toggle staged */}
      <TouchableOpacity
        style={[s.badge, { borderColor: color, backgroundColor: color + '22' }]}
        onPress={() => onToggle(file)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={[s.badgeText, { color }]}>{label}</Text>
      </TouchableOpacity>

      {/* Filename — tap to view diff */}
      <TouchableOpacity style={s.filePath} onPress={() => onDiff(file)}>
        <Text style={s.fileText} numberOfLines={1}>{file.path}</Text>
        <Text style={s.fileAction}>{file.staged ? 'tap to unstage' : 'tap badge to stage · tap name for diff'}</Text>
      </TouchableOpacity>

      {/* Staged checkmark */}
      {file.staged && <Text style={s.check}>✓</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingHint:    { color: '#8b949e', fontSize: 14, marginTop: 12 },
  loadingSubHint: { color: '#30363d', fontSize: 12 },

  commitBox: {
    backgroundColor: '#161b22',
    borderBottomWidth: 1, borderBottomColor: '#21262d',
    padding: 14,
  },
  commitInput: {
    color: '#c9d1d9', borderWidth: 1, borderColor: '#30363d',
    borderRadius: 8, padding: 10, fontSize: 14,
    minHeight: 56, textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', marginTop: 10, gap: 8, flexWrap: 'wrap' },

  stageAllBtn: {
    paddingVertical: 9, paddingHorizontal: 14, borderRadius: 8,
    borderWidth: 1, borderColor: '#30363d', backgroundColor: '#21262d',
  },
  stageAllText: { color: '#c9d1d9', fontSize: 13, fontWeight: '600' },

  unstageAllBtn: {
    paddingVertical: 9, paddingHorizontal: 14, borderRadius: 8,
    borderWidth: 1, borderColor: '#d29922', backgroundColor: '#1a1500',
  },
  unstageAllText: { color: '#d29922', fontSize: 13, fontWeight: '600' },

  commitBtn: {
    flex: 1, backgroundColor: '#238636', paddingVertical: 10,
    borderRadius: 8, alignItems: 'center', minWidth: 100,
  },
  commitBtnOff:  { backgroundColor: '#1a3520', opacity: 0.6 },
  commitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  stagedHint: { color: '#3fb950', fontSize: 12, marginTop: 8, textAlign: 'center' },

  cleanBox: { alignItems: 'center', paddingTop: 60, paddingBottom: 20, gap: 8 },
  cleanIcon: { fontSize: 36, color: '#3fb950' },
  cleanText: { color: '#3fb950', fontSize: 16, fontWeight: '600' },
  cleanSub:  { color: '#8b949e', fontSize: 13 },

  sectionHead: {
    color: '#58a6ff', fontSize: 11, fontWeight: '700',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#0d1117',
    letterSpacing: 0.8,
  },

  fileRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#161b22',
  },
  fileRowStaged: { backgroundColor: '#0d1a0d' },

  badge: {
    width: 28, height: 28, borderRadius: 6, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  badgeText: { fontSize: 12, fontWeight: '800' },

  filePath: { flex: 1 },
  fileText: { color: '#c9d1d9', fontSize: 13, fontFamily: 'monospace' },
  fileAction: { color: '#30363d', fontSize: 10, marginTop: 2 },

  check: { color: '#3fb950', fontSize: 16, marginLeft: 8 },

  backBtn: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#21262d' },
  backText: { color: '#58a6ff', fontSize: 14 },
  diffText: { fontFamily: 'monospace', fontSize: 12, color: '#c9d1d9', padding: 14, lineHeight: 18 },
});
