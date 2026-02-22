import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import { listBranches, createBranch, checkoutBranch, deleteBranch } from '../git/gitOps';
import { useStore } from '../store/useStore';
import { Icon } from '../components/Icon';

export default function BranchesScreen({ route }) {
  const { dir } = route.params;
  const { updateRepoBranch } = useStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newBranch, setNewBranch] = useState('');

  const load = useCallback(async () => {
    try {
      const b = await listBranches(dir);
      setData(b);
      if (b.current) updateRepoBranch(dir, b.current);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  }, [dir]);

  useEffect(() => { load(); }, [load]);

  const checkout = async (name) => {
    try {
      await checkoutBranch(dir, name);
      load();
    } catch (e) { Alert.alert('Checkout failed', e.message); }
  };

  const doCreate = async () => {
    if (!newBranch.trim()) return;
    try {
      await createBranch(dir, newBranch.trim(), true);
      setShowNew(false);
      setNewBranch('');
      load();
    } catch (e) { Alert.alert('Create failed', e.message); }
  };

  const doDelete = (name) => {
    Alert.alert('Delete Branch', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await deleteBranch(dir, name); load(); }
          catch (e) { Alert.alert('Delete failed', e.message); }
        },
      },
    ]);
  };

  if (loading) return <View style={s.center}><ActivityIndicator color="#58a6ff" size="large" /></View>;

  const all = [...(data?.local ?? []), ...(data?.remote ?? [])];

  return (
    <View style={s.container}>
      <FlatList
        data={all}
        keyExtractor={b => b.fullName ?? b.name}
        ListHeaderComponent={
          <TouchableOpacity style={s.newBtn} onPress={() => setShowNew(true)}>
            <Icon name="plus" size={18} color="#fff" />
            <Text style={s.newBtnText}>  New Branch</Text>
          </TouchableOpacity>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[s.row, item.isCurrent && s.rowActive]}
            onPress={() => !item.isRemote && checkout(item.name)}
            onLongPress={() => !item.isCurrent && !item.isRemote && doDelete(item.name)}
          >
            <Icon name={item.isRemote ? 'cloud' : 'branch'} size={18} color="#8b949e" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[s.name, item.isCurrent && s.nameCurrent]}>
                {item.name}
              </Text>
              {item.isRemote && <Text style={s.remote}>remote</Text>}
            </View>
            {item.isCurrent && <Text style={s.current}>● current</Text>}
          </TouchableOpacity>
        )}
      />

      <Modal visible={showNew} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>New Branch</Text>
            <TextInput
              style={s.modalInput}
              placeholder="branch-name"
              placeholderTextColor="#8b949e"
              value={newBranch}
              onChangeText={setNewBranch}
              autoFocus
              autoCapitalize="none"
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowNew(false)}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.createBtn} onPress={doCreate}>
                <Text style={s.createText}>Create &amp; Checkout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  newBtn: {
    margin: 16, backgroundColor: '#238636', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#161b22',
  },
  rowActive: { backgroundColor: '#161b22' },
  name: { color: '#c9d1d9', fontSize: 15 },
  nameCurrent: { color: '#58a6ff', fontWeight: '600' },
  remote: { color: '#8b949e', fontSize: 11, marginTop: 2 },
  current: { color: '#3fb950', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: '#161b22', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 24, paddingBottom: 40,
  },
  modalTitle: { color: '#c9d1d9', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  modalInput: {
    backgroundColor: '#0d1117', borderWidth: 1, borderColor: '#30363d',
    borderRadius: 8, color: '#c9d1d9', padding: 12, fontSize: 15, marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: '#30363d',
    borderRadius: 8, paddingVertical: 12, alignItems: 'center',
  },
  cancelText: { color: '#8b949e', fontSize: 14 },
  createBtn: {
    flex: 2, backgroundColor: '#238636',
    borderRadius: 8, paddingVertical: 12, alignItems: 'center',
  },
  createText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
