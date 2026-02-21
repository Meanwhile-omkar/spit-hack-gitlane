import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert,
} from 'react-native';
import { useStore } from '../store/useStore';

export default function SettingsScreen({ navigation }) {
  const { creds, saveCreds } = useStore();
  const [name, setName] = useState(creds.name);
  const [email, setEmail] = useState(creds.email);
  const [token, setToken] = useState(creds.token);

  const save = async () => {
    await saveCreds({ name: name.trim(), email: email.trim(), token: token.trim() });
    Alert.alert('Saved', 'Credentials saved.');
    navigation.goBack();
  };

  return (
    <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
      <Text style={s.heading}>Settings</Text>

      <Text style={s.section}>Git Identity</Text>
      <Text style={s.label}>Name</Text>
      <TextInput style={s.input} value={name} onChangeText={setName}
        placeholder="Your Name" placeholderTextColor="#8b949e" />

      <Text style={s.label}>Email</Text>
      <TextInput style={s.input} value={email} onChangeText={setEmail}
        placeholder="you@example.com" placeholderTextColor="#8b949e"
        keyboardType="email-address" autoCapitalize="none" />

      <Text style={s.section}>Authentication</Text>
      <Text style={s.label}>GitHub / GitLab PAT Token</Text>
      <TextInput
        style={s.input}
        value={token}
        onChangeText={setToken}
        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
        placeholderTextColor="#8b949e"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />
      <Text style={s.hint}>
        Generate at GitHub → Settings → Developer settings → Personal access tokens.{'\n'}
        Needs: repo, read:user
      </Text>

      <TouchableOpacity style={s.saveBtn} onPress={save}>
        <Text style={s.saveBtnText}>Save</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', padding: 20 },
  heading: { fontSize: 20, fontWeight: '700', color: '#c9d1d9', marginBottom: 24 },
  section: { fontSize: 13, fontWeight: '700', color: '#58a6ff', marginTop: 24, marginBottom: 12, textTransform: 'uppercase' },
  label: { fontSize: 13, color: '#8b949e', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#161b22', borderWidth: 1, borderColor: '#30363d',
    borderRadius: 8, color: '#c9d1d9', padding: 12, fontSize: 15,
  },
  hint: { color: '#8b949e', fontSize: 12, marginTop: 8, lineHeight: 18 },
  saveBtn: {
    marginTop: 32, backgroundColor: '#238636', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
