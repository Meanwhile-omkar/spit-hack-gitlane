import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, TextInput, Modal, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { listBranches, getRemoteUrl } from '../git/gitOps';
import {
  parseGitHubUrl, listPRs, createPR, mergePR,
  getPRDetails, getDefaultBranch,
} from '../github/githubApi';
import { useStore } from '../store/useStore';

export default function PRScreen({ route }) {
  const { dir } = route.params;
  const { creds } = useStore();
  const token = creds.token;

  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [error, setError]             = useState(null);
  const [prs, setPrs]                 = useState([]);
  const [repoInfo, setRepoInfo]       = useState(null);
  const [branches, setBranches]       = useState([]);
  const [currentBranch, setCurrent]   = useState('');
  const [defaultBase, setDefaultBase] = useState('main');

  // PR detail
  const [selectedPR, setSelectedPR]   = useState(null);
  const [prDetail, setPrDetail]       = useState(null);
  const [detailLoading, setDLLoading] = useState(false);
  const [merging, setMerging]         = useState(false);

  // Create PR modal
  const [showCreate, setShowCreate]   = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createBody, setCreateBody]   = useState('');
  const [createBase, setCreateBase]   = useState('main');
  const [createHead, setCreateHead]   = useState('');
  const [creating, setCreating]       = useState(false);

  // ── Load PR list ───────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!token) {
      setError('No PAT token set. Go to Settings → add your GitHub token.');
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const [remoteUrl, branchData] = await Promise.all([
        getRemoteUrl(dir),
        listBranches(dir),
      ]);
      const info = parseGitHubUrl(remoteUrl);
      if (!info) {
        setError('Remote is not a GitHub repo. PRs only work with github.com.');
        setLoading(false);
        return;
      }
      setRepoInfo(info);
      const cur = branchData.current ?? '';
      setCurrent(cur);
      setBranches(branchData.local.map(b => b.name));

      const [openPRs, defBranch] = await Promise.all([
        listPRs(token, info.owner, info.repo),
        getDefaultBranch(token, info.owner, info.repo),
      ]);
      setPrs(openPRs);
      setDefaultBase(defBranch);
      setCreateBase(defBranch);
      setCreateHead(cur);
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [dir, token]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  // ── Open PR detail ─────────────────────────────────────────────────────────
  const openDetail = async (pr) => {
    setSelectedPR(pr);
    setPrDetail(null);
    setDLLoading(true);
    try {
      const detail = await getPRDetails(token, repoInfo.owner, repoInfo.repo, pr.number);
      setPrDetail(detail);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setDLLoading(false);
    }
  };

  const closeDetail = () => { setSelectedPR(null); setPrDetail(null); };

  // ── Merge PR ───────────────────────────────────────────────────────────────
  const doMerge = () => {
    Alert.alert(
      'Merge Pull Request',
      `Merge "${selectedPR.title}" into ${selectedPR.base.ref}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Merge', onPress: async () => {
            setMerging(true);
            try {
              await mergePR(token, repoInfo.owner, repoInfo.repo, selectedPR.number);
              Alert.alert('Merged! 🎉', `PR #${selectedPR.number} merged into ${selectedPR.base.ref}.`);
              closeDetail();
              load();
            } catch (e) {
              Alert.alert('Merge failed', e.message);
            } finally {
              setMerging(false);
            }
          },
        },
      ],
    );
  };

  // ── Create PR ──────────────────────────────────────────────────────────────
  const openCreate = () => {
    setCreateHead(currentBranch);
    setCreateBase(defaultBase);
    setCreateTitle('');
    setCreateBody('');
    setShowCreate(true);
  };

  const doCreate = async () => {
    if (!createTitle.trim()) { Alert.alert('Title required'); return; }
    if (createHead === createBase) { Alert.alert('Error', 'Head and base branch must be different.'); return; }
    setCreating(true);
    try {
      const pr = await createPR(token, repoInfo.owner, repoInfo.repo, {
        head: createHead,
        base: createBase,
        title: createTitle.trim(),
        body: createBody.trim(),
      });
      setShowCreate(false);
      Alert.alert('PR Created! 🎉', `PR #${pr.number}: "${pr.title}"\n\nOthers can now review and merge it.`);
      load();
    } catch (e) {
      Alert.alert('Create failed', e.message);
    } finally {
      setCreating(false);
    }
  };

  // ── States ─────────────────────────────────────────────────────────────────
  if (loading) return <View style={s.center}><ActivityIndicator color="#58a6ff" size="large" /></View>;

  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.errorIcon}>⚠️</Text>
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => { setLoading(true); load(); }}>
          <Text style={s.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── PR Detail view ─────────────────────────────────────────────────────────
  if (selectedPR) {
    const freshPR = prDetail?.pr ?? selectedPR;
    const hasConflicts = freshPR.mergeable === false;
    const canMerge = freshPR.state === 'open' && freshPR.mergeable !== false;

    return (
      <View style={s.container}>
        <TouchableOpacity style={s.backBtn} onPress={closeDetail}>
          <Text style={s.backText}>← Pull Requests</Text>
        </TouchableOpacity>

        <ScrollView style={s.detailScroll} contentContainerStyle={{ paddingBottom: 32 }}>
          {/* Header */}
          <View style={s.detailHead}>
            <Text style={s.prNumber}>#{freshPR.number}</Text>
            <View style={[s.stateBadge, freshPR.state === 'open' ? s.badgeOpen : s.badgeMerged]}>
              <Text style={s.badgeText}>{freshPR.state}</Text>
            </View>
          </View>

          <Text style={s.prTitle}>{freshPR.title}</Text>

          {/* Branch flow */}
          <View style={s.branchFlow}>
            <View style={s.branchChip}><Text style={s.branchText}>{freshPR.head.ref}</Text></View>
            <Text style={s.arrow}>→</Text>
            <View style={s.branchChip}><Text style={s.branchText}>{freshPR.base.ref}</Text></View>
          </View>

          <Text style={s.prAuthor}>opened by {freshPR.user?.login}</Text>
          {freshPR.body ? <Text style={s.prBody}>{freshPR.body}</Text> : null}

          {/* Conflict warning */}
          {hasConflicts && (
            <View style={s.conflictBox}>
              <Text style={s.conflictText}>
                ⚠️  Merge conflict detected.{'\n'}
                Resolve conflicts locally → commit → push, then merge.
              </Text>
            </View>
          )}

          {detailLoading ? (
            <ActivityIndicator color="#58a6ff" style={{ margin: 20 }} />
          ) : prDetail?.files?.length > 0 ? (
            <>
              <Text style={s.sectionHead}>Changed Files ({prDetail.files.length})</Text>
              {prDetail.files.map(f => (
                <View key={f.filename} style={s.fileRow}>
                  <Text style={[s.fileStatusDot, fileColor(f.status)]}>{f.status[0].toUpperCase()}</Text>
                  <Text style={s.fileName} numberOfLines={1}>{f.filename}</Text>
                  <Text style={s.fileStat}>
                    {f.additions > 0 ? `+${f.additions} ` : ''}
                    {f.deletions > 0 ? `-${f.deletions}` : ''}
                  </Text>
                </View>
              ))}
            </>
          ) : null}

          {/* Merge button */}
          {freshPR.state === 'open' && (
            <TouchableOpacity
              style={[s.mergeBtn, (!canMerge || merging) && s.mergeBtnDis]}
              onPress={canMerge ? doMerge : undefined}
              disabled={!canMerge || merging}
            >
              {merging
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.mergeBtnText}>
                    {canMerge ? '⬡  Merge Pull Request' : '✕  Cannot Merge (conflicts)'}
                  </Text>}
            </TouchableOpacity>
          )}
          {freshPR.state !== 'open' && (
            <View style={[s.mergeBtn, s.mergeBtnMerged]}>
              <Text style={s.mergeBtnMergedText}>✓  Already merged</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── PR List view ───────────────────────────────────────────────────────────
  return (
    <View style={s.container}>
      {/* New PR button */}
      <TouchableOpacity style={s.newBtn} onPress={openCreate}>
        <Text style={s.newBtnText}>＋  New Pull Request</Text>
      </TouchableOpacity>

      {prs.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>🔀</Text>
          <Text style={s.emptyTitle}>No open pull requests</Text>
          <Text style={s.emptyDesc}>
            Create a branch, make changes, push it,{'\n'}then open a PR to merge into {defaultBase}.
          </Text>
          {currentBranch !== defaultBase && (
            <Text style={s.currentBranchHint}>You're on: <Text style={{ color: '#58a6ff' }}>{currentBranch}</Text></Text>
          )}
        </View>
      ) : (
        <FlatList
          data={prs}
          keyExtractor={p => String(p.number)}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
              tintColor="#58a6ff"
            />
          }
          renderItem={({ item: pr }) => (
            <TouchableOpacity style={s.prCard} onPress={() => openDetail(pr)}>
              <View style={s.prCardTop}>
                <Text style={s.prNum}>#{pr.number}</Text>
                <Text style={s.prCardTitle} numberOfLines={2}>{pr.title}</Text>
              </View>
              <View style={s.prCardMeta}>
                <Text style={s.prBranches}>{pr.head.ref}  →  {pr.base.ref}</Text>
                <Text style={s.prUser}>{pr.user?.login}</Text>
              </View>
              {pr.draft && <Text style={s.draft}>Draft</Text>}
            </TouchableOpacity>
          )}
        />
      )}

      {/* Create PR Modal */}
      <Modal visible={showCreate} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>New Pull Request</Text>

            <Text style={s.modalLabel}>From (head branch)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
              {branches.map(b => (
                <TouchableOpacity
                  key={b}
                  style={[s.chip, createHead === b && s.chipActive]}
                  onPress={() => setCreateHead(b)}
                >
                  <Text style={[s.chipText, createHead === b && s.chipTextActive]}>{b}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.modalLabel}>Into (base branch)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
              {branches.filter(b => b !== createHead).map(b => (
                <TouchableOpacity
                  key={b}
                  style={[s.chip, createBase === b && s.chipActive]}
                  onPress={() => setCreateBase(b)}
                >
                  <Text style={[s.chipText, createBase === b && s.chipTextActive]}>{b}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.modalLabel}>Title</Text>
            <TextInput
              style={s.input}
              placeholder="PR title..."
              placeholderTextColor="#8b949e"
              value={createTitle}
              onChangeText={setCreateTitle}
            />

            <Text style={s.modalLabel}>Description (optional)</Text>
            <TextInput
              style={[s.input, s.inputMulti]}
              placeholder="What does this PR change?"
              placeholderTextColor="#8b949e"
              value={createBody}
              onChangeText={setCreateBody}
              multiline
            />

            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowCreate(false)}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.submitBtn} onPress={doCreate} disabled={creating}>
                {creating
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.submitText}>Create PR</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function fileColor(status) {
  if (status === 'added')   return { color: '#3fb950' };
  if (status === 'removed') return { color: '#f78166' };
  if (status === 'renamed') return { color: '#58a6ff' };
  return { color: '#d29922' };
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  errorIcon: { fontSize: 40, marginBottom: 12 },
  errorText: { color: '#f78166', textAlign: 'center', marginBottom: 16, fontSize: 14, lineHeight: 20 },
  retryBtn:  { backgroundColor: '#21262d', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#c9d1d9' },

  newBtn:     { margin: 12, backgroundColor: '#238636', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  emptyIcon:         { fontSize: 48, marginBottom: 10 },
  emptyTitle:        { color: '#c9d1d9', fontSize: 17, fontWeight: '600', marginBottom: 8 },
  emptyDesc:         { color: '#8b949e', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  currentBranchHint: { color: '#8b949e', fontSize: 12, marginTop: 12 },

  prCard: {
    marginHorizontal: 12, marginTop: 10,
    backgroundColor: '#161b22', borderRadius: 10,
    borderWidth: 1, borderColor: '#21262d', padding: 14,
  },
  prCardTop:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  prNum:       { color: '#58a6ff', fontFamily: 'monospace', fontSize: 12, marginTop: 2 },
  prCardTitle: { flex: 1, color: '#c9d1d9', fontSize: 15, fontWeight: '600' },
  prCardMeta:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  prBranches:  { color: '#3fb950', fontSize: 12, fontFamily: 'monospace' },
  prUser:      { color: '#8b949e', fontSize: 12 },
  draft:       { color: '#8b949e', fontSize: 11, fontStyle: 'italic', marginTop: 6 },

  // Detail
  backBtn:    { padding: 14, borderBottomWidth: 1, borderBottomColor: '#21262d' },
  backText:   { color: '#58a6ff', fontSize: 14 },
  detailScroll: { flex: 1 },
  detailHead: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10 },
  prNumber:   { color: '#8b949e', fontFamily: 'monospace', fontSize: 14 },
  stateBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeOpen:   { backgroundColor: '#1a3520', borderWidth: 1, borderColor: '#3fb950' },
  badgeMerged: { backgroundColor: '#2d1a4a', borderWidth: 1, borderColor: '#bc8cff' },
  badgeText:  { color: '#c9d1d9', fontSize: 12, fontWeight: '600' },
  prTitle:    { color: '#c9d1d9', fontSize: 18, fontWeight: '700', paddingHorizontal: 16, marginBottom: 10 },
  branchFlow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  branchChip: { backgroundColor: '#161b22', borderRadius: 6, borderWidth: 1, borderColor: '#21262d', paddingHorizontal: 10, paddingVertical: 5 },
  branchText: { color: '#58a6ff', fontFamily: 'monospace', fontSize: 13 },
  arrow:      { color: '#8b949e', fontSize: 16 },
  prAuthor:   { color: '#8b949e', fontSize: 13, paddingHorizontal: 16, marginBottom: 12 },
  prBody:     { color: '#c9d1d9', fontSize: 14, paddingHorizontal: 16, marginBottom: 16, lineHeight: 20 },
  conflictBox:  { margin: 16, backgroundColor: '#2d1a00', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#d29922' },
  conflictText: { color: '#d29922', fontSize: 13, lineHeight: 22 },
  sectionHead:  { color: '#8b949e', fontSize: 11, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 10, textTransform: 'uppercase' },
  fileRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#161b22', gap: 8 },
  fileStatusDot: { fontWeight: '700', fontSize: 12, width: 16, textAlign: 'center' },
  fileName:      { flex: 1, color: '#c9d1d9', fontSize: 13, fontFamily: 'monospace' },
  fileStat:      { color: '#8b949e', fontSize: 12 },
  mergeBtn:      { margin: 16, backgroundColor: '#1a3520', borderRadius: 10, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: '#3fb950' },
  mergeBtnDis:   { backgroundColor: '#161b22', borderColor: '#30363d' },
  mergeBtnText:  { color: '#3fb950', fontWeight: '700', fontSize: 15 },
  mergeBtnMerged:     { backgroundColor: '#161b22', borderColor: '#30363d' },
  mergeBtnMergedText: { color: '#8b949e', fontWeight: '700', fontSize: 15 },

  // Modal
  overlay:     { flex: 1, backgroundColor: '#00000099', justifyContent: 'flex-end' },
  modal:       { backgroundColor: '#161b22', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24, paddingBottom: 44 },
  modalTitle:  { color: '#c9d1d9', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  modalLabel:  { color: '#8b949e', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
  chipRow:     { marginBottom: 4 },
  chip:        { marginRight: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#30363d', backgroundColor: '#0d1117' },
  chipActive:  { backgroundColor: '#0d419d', borderColor: '#58a6ff' },
  chipText:    { color: '#8b949e', fontFamily: 'monospace', fontSize: 13 },
  chipTextActive: { color: '#58a6ff', fontWeight: '700' },
  input:       { backgroundColor: '#0d1117', borderWidth: 1, borderColor: '#30363d', borderRadius: 8, color: '#c9d1d9', padding: 12, fontSize: 14 },
  inputMulti:  { height: 80, textAlignVertical: 'top', marginBottom: 4 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelBtn:   { flex: 1, borderWidth: 1, borderColor: '#30363d', borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
  cancelText:  { color: '#8b949e', fontSize: 14 },
  submitBtn:   { flex: 2, backgroundColor: '#238636', borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
  submitText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
});
