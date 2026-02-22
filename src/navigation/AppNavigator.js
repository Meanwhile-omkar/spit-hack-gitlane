import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from '../screens/HomeScreen';
import CloneScreen from '../screens/CloneScreen';
import LogScreen from '../screens/LogScreen';
import FilesScreen from '../screens/FilesScreen';
import ChangesScreen from '../screens/ChangesScreen';
import BranchesScreen from '../screens/BranchesScreen';
import RemoteScreen from '../screens/RemoteScreen';
import PRScreen from '../screens/PRScreen';
import PeerScreen from '../screens/PeerScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useStore } from '../store/useStore';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/** Pill capsule in the header showing connection status */
function ConnectionPill() {
  const { isOnline } = useNetworkStatus();
  return (
    <View style={[p.pill, isOnline ? p.pillOnline : p.pillOffline]}>
      <View style={[p.dot, isOnline ? p.dotOnline : p.dotOffline]} />
      <Text style={[p.label, isOnline ? p.labelOnline : p.labelOffline]}>
        {isOnline ? 'Online' : 'Offline'}
      </Text>
    </View>
  );
}

const p = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, gap: 5, marginRight: 4,
  },
  pillOnline:  { backgroundColor: '#132113', borderWidth: 1, borderColor: '#3fb950' },
  pillOffline: { backgroundColor: '#2d1a00', borderWidth: 1, borderColor: '#d29922' },
  dot:        { width: 7, height: 7, borderRadius: 4 },
  dotOnline:  { backgroundColor: '#3fb950' },
  dotOffline: { backgroundColor: '#d29922' },
  label:       { fontSize: 11, fontWeight: '700' },
  labelOnline: { color: '#3fb950' },
  labelOffline:{ color: '#d29922' },
});

/** Bottom tab navigator shown when a repo is open */
function RepoTabs({ route }) {
  const { dir } = route.params;
  const { pendingPushCount } = useStore();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: { backgroundColor: '#161b22', borderTopColor: '#21262d' },
        tabBarActiveTintColor: '#58a6ff',
        tabBarInactiveTintColor: '#8b949e',
        headerShown: false,   // Stack header above handles title + back button
      }}
    >
      <Tab.Screen
        name="Log"
        component={LogScreen}
        initialParams={{ dir }}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📋</Text> }}
      />
      <Tab.Screen
        name="Files"
        component={FilesScreen}
        initialParams={{ dir }}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📁</Text> }}
      />
      <Tab.Screen
        name="Changes"
        component={ChangesScreen}
        initialParams={{ dir }}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>✏️</Text> }}
      />
      <Tab.Screen
        name="Branches"
        component={BranchesScreen}
        initialParams={{ dir }}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>⎇</Text> }}
      />
      <Tab.Screen
        name="PRs"
        component={PRScreen}
        initialParams={{ dir }}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🔀</Text> }}
      />
      <Tab.Screen
        name="Remote"
        component={RemoteScreen}
        initialParams={{ dir }}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>☁️</Text>,
          tabBarBadge: pendingPushCount > 0 ? pendingPushCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#d29922', color: '#fff', fontSize: 10 },
        }}
      />
      <Tab.Screen
        name="Peer"
        component={PeerScreen}
        initialParams={{ dir }}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📡</Text> }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#161b22' },
          headerTintColor: '#c9d1d9',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'GitLane' }} />
        <Stack.Screen name="Clone" component={CloneScreen} options={{ title: 'Clone Repository' }} />
        <Stack.Screen
          name="RepoTabs"
          component={RepoTabs}
          options={({ route }) => ({
            title: route.params.name,
            headerRight: () => <ConnectionPill />,
          })}
        />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
