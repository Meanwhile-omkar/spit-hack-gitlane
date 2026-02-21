import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import RNFS from 'react-native-fs';

const TEXT_EXTS = new Set([
  'js', 'ts', 'jsx', 'tsx', 'json', 'md', 'txt', 'py', 'java', 'kt',
  'css', 'html', 'xml', 'gradle', 'yaml', 'yml', 'sh', 'env', 'rb',
  'go', 'rs', 'cpp', 'c', 'h', 'swift', 'properties', 'gradle', 'toml',
  'gitignore', 'editorconfig', 'eslintrc', 'babelrc', 'prettierrc',
]);

function isText(name) {
  const parts = name.split('.');
  if (parts.length < 2) return true; // no extension = likely text
  return TEXT_EXTS.has(parts[parts.length - 1].toLowerCase());
}

export default function FilesScreen({ route }) {
  const { dir } = route.params;
  const [currentPath, setCurrentPath] = useState(dir);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingFile, setEditingFile] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const loadDir = useCallback(async (path) => {
    setLoading(true);
    try {
      const raw = await RNFS.readDir(path);
      const filtered = raw
        .filter(i => i.name !== '.git')
        .sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        });
      setItems(filtered);
    } catch (e) {
      Alert.alert('Error reading directory', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!editingFile) loadDir(currentPath);
  }, [currentPath, editingFile, loadDir]);

  const openItem = async (item) => {
    if (item.isDirectory()) {
      setCurrentPath(item.path);
      return;
    }
    if (!isText(item.name)) {
      Alert.alert('Binary file', 'This file type cannot be edited as text.');
      return;
    }
    try {
      const content = await RNFS.readFile(item.path, 'utf8');
      setEditingFile({ path: item.path, name: item.name });
      setEditContent(content);
      setDirty(false);
    } catch (e) {
      Alert.alert('Cannot open file', e.message);
    }
  };

  const saveFile = async () => {
    if (!editingFile) return;
    setSaving(true);
    try {
      await RNFS.writeFile(editingFile.path, editContent, 'utf8');
      setDirty(false);
      Alert.alert(
        'Saved',
        `Changes saved to ${editingFile.name}.\n\nSwitch to the Changes tab to stage and commit.`,
      );
    } catch (e) {
      Alert.alert('Save failed', e.message);
    } finally {
      setSaving(false);
    }
  };

  const closeEditor = () => {
    if (dirty) {
      Alert.alert('Unsaved changes', 'Discard changes and go back?', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => setEditingFile(null) },
      ]);
    } else {
      setEditingFile(null);
    }
  };

  const goUp = () => {
    if (currentPath === dir) return;
    const parts = currentPath.split('/');
    parts.pop();
    setCurrentPath(parts.join('/'));
  };

  // ── Editor view ────────────────────────────────────────────────────────────
  if (editingFile) {
    const relPath = editingFile.path.replace(dir + '/', '');
    return (
      <View style={s.container}>
        <View style={s.editorHeader}>
          <TouchableOpacity onPress={closeEditor} style={s.backBtn}>
            <Text style={s.backText} numberOfLines={1}>← {relPath}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={saveFile}
            style={[s.saveBtn, !dirty && s.saveBtnDim]}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.saveText}>{dirty ? 'Save' : 'Saved'}</Text>}
          </TouchableOpacity>
        </View>
        <TextInput
          style={s.editor}
          value={editContent}
          onChangeText={t => { setEditContent(t); setDirty(true); }}
          multiline
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          textAlignVertical="top"
        />
      </View>
    );
  }

  // ── File browser view ──────────────────────────────────────────────────────
  const breadcrumb = currentPath === dir ? '/' : '/' + currentPath.replace(dir + '/', '');

  return (
    <View style={s.container}>
      <View style={s.breadcrumbRow}>
        {currentPath !== dir && (
          <TouchableOpacity onPress={goUp} style={s.upBtn}>
            <Text style={s.upText}>↑</Text>
          </TouchableOpacity>
        )}
        <Text style={s.breadcrumb} numberOfLines={1}>{breadcrumb}</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color="#58a6ff" size="large" /></View>
      ) : items.length === 0 ? (
        <View style={s.center}><Text style={s.empty}>Empty directory</Text></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.path}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.item} onPress={() => openItem(item)}>
              <Text style={s.itemIcon}>{item.isDirectory() ? '📁' : '📄'}</Text>
              <Text
                style={[s.itemName, item.isDirectory() && s.dirName]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              {item.isDirectory() && <Text style={s.chevron}>›</Text>}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#8b949e', fontSize: 14 },

  breadcrumbRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#161b22', borderBottomWidth: 1, borderBottomColor: '#21262d',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  upBtn: { marginRight: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#21262d', borderRadius: 6 },
  upText: { color: '#58a6ff', fontSize: 14, fontWeight: '700' },
  breadcrumb: { flex: 1, color: '#8b949e', fontSize: 12, fontFamily: 'monospace' },

  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#161b22',
  },
  itemIcon: { fontSize: 16, marginRight: 10 },
  itemName: { flex: 1, color: '#c9d1d9', fontSize: 14, fontFamily: 'monospace' },
  dirName: { color: '#58a6ff' },
  chevron: { color: '#8b949e', fontSize: 18 },

  editorHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#161b22', borderBottomWidth: 1, borderBottomColor: '#21262d',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  backBtn: { flex: 1, marginRight: 8 },
  backText: { color: '#58a6ff', fontSize: 14 },
  saveBtn: {
    backgroundColor: '#238636', paddingHorizontal: 18,
    paddingVertical: 8, borderRadius: 8, minWidth: 70, alignItems: 'center',
  },
  saveBtnDim: { backgroundColor: '#1a3520' },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  editor: {
    flex: 1,
    color: '#c9d1d9',
    fontFamily: 'monospace',
    fontSize: 13,
    padding: 14,
    lineHeight: 20,
    backgroundColor: '#0d1117',
  },
});
