import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from '../screens/HomeScreen';
import CloneScreen from '../screens/CloneScreen';
import LogScreen from '../screens/LogScreen';
import ChangesScreen from '../screens/ChangesScreen';
import BranchesScreen from '../screens/BranchesScreen';
import RemoteScreen from '../screens/RemoteScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const DARK_HEADER = {
  headerStyle: { backgroundColor: '#161b22' },
  headerTintColor: '#c9d1d9',
  headerTitleStyle: { fontWeight: '700' },
};

/** Bottom tab navigator shown when a repo is open */
function RepoTabs({ route }) {
  const { dir, name } = route.params;
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: { backgroundColor: '#161b22', borderTopColor: '#21262d' },
        tabBarActiveTintColor: '#58a6ff',
        tabBarInactiveTintColor: '#8b949e',
        ...DARK_HEADER,
        headerTitle: name,
      }}
    >
      <Tab.Screen
        name="Log"
        component={LogScreen}
        initialParams={{ dir }}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📋</Text> }}
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
        name="Remote"
        component={RemoteScreen}
        initialParams={{ dir }}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>☁️</Text> }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={DARK_HEADER}>
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'GitLane' }} />
        <Stack.Screen name="Clone" component={CloneScreen} options={{ title: 'Clone Repository' }} />
        <Stack.Screen name="RepoTabs" component={RepoTabs} options={{ headerShown: false }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
