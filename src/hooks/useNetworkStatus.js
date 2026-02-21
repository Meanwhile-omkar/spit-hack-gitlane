import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Returns { isOnline: boolean }.
 * isOnline is true when the device has an internet-reachable connection.
 * Uses `isInternetReachable` (null → treat as unknown → optimistic true).
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Get initial state
    NetInfo.fetch().then(state => {
      setIsOnline(state.isInternetReachable !== false);
    });

    const unsub = NetInfo.addEventListener(state => {
      setIsOnline(state.isInternetReachable !== false);
    });
    return unsub;
  }, []);

  return { isOnline };
}
