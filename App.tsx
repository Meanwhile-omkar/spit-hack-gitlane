import React, { useEffect } from 'react';
import { useStore } from './src/store/useStore';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  const { loadCreds } = useStore();
  useEffect(() => { loadCreds(); }, []);
  return <AppNavigator />;
}
