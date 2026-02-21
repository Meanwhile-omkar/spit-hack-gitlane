import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { getLog } from '../git/gitOps';
import { useStore } from '../store/useStore';

const COLORS = ['#58a6ff', '#3fb950', '#f78166', '#d29922', '#bc8cff', '#56d364'];

export default function LogScreen({ route }) {
  const { dir } = route.params;
  const { updateRepoBranch } = useStore();
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const log = await getLog(dir, { depth: 150 });
      setCommits(log);
      if (log[0]) updateRepoBranch(dir, log[0].sha.slice(0, 7));
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dir]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={s.center}><ActivityIndicator color="#58a6ff" size="large" /></View>;
  if (error) return <View style={s.center}><Text style={s.err}>{error}</Text></View>;

  return (
    <FlatList
      style={s.list}
      data={commits}
      keyExtractor={c => c.sha}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#58a6ff" />}
      renderItem={({ item, index }) => <CommitRow commit={item} index={index} color={COLORS[index % COLORS.length]} />}
    />
  );
}

function CommitRow({ commit, index, color }) {
  const date = new Date(commit.authoredAt);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return (
    <View style={s.row}>
      {/* Graph lane dot */}
      <View style={s.graphCol}>
        <View style={[s.dot, { backgroundColor: color }]} />
        <View style={s.line} />
      </View>
      <View style={s.content}>
        <Text style={s.summary} numberOfLines={2}>{commit.summary}</Text>
        <View style={s.meta}>
          <Text style={s.sha}>{commit.shortSha}</Text>
          <Text style={s.author} numberOfLines={1}>{commit.authorName}</Text>
          <Text style={s.date}>{dateStr}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#0d1117' },
  center: { flex: 1, backgroundColor: '#0d1117', alignItems: 'center', justifyContent: 'center' },
  err: { color: '#f78166', padding: 20, textAlign: 'center' },
  row: { flexDirection: 'row', paddingRight: 16, paddingVertical: 6 },
  graphCol: { width: 36, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  line: { flex: 1, width: 2, backgroundColor: '#21262d' },
  content: { flex: 1, paddingLeft: 8, paddingVertical: 4 },
  summary: { color: '#c9d1d9', fontSize: 14, fontWeight: '500' },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
  sha: {
    color: '#58a6ff', fontFamily: 'monospace', fontSize: 12,
    backgroundColor: '#161b22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  author: { color: '#8b949e', fontSize: 12, flex: 1 },
  date: { color: '#8b949e', fontSize: 11 },
});
