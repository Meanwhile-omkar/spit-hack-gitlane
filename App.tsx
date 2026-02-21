import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useStore } from './src/store/useStore';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  const { loadCreds, loadPendingCount, flushPushQueue } = useStore();

  const wasOnline = useRef<boolean | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadCreds();
    loadPendingCount();
  }, []);

  const dismiss = useCallback(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
    Animated.timing(slideAnim, {
      toValue: -80,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setShowBanner(false));
  }, [slideAnim]);

  const showOffline = useCallback(() => {
    setShowBanner(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start();
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(dismiss, 6500);
  }, [slideAnim, dismiss]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      const online = state.isInternetReachable !== false;

      if (wasOnline.current === true && !online) {
        // Just went offline — show banner
        showOffline();
      } else if (wasOnline.current === false && online) {
        // Back online — hide banner + flush queue
        dismiss();
        flushPushQueue();
      }
      wasOnline.current = online;
    });

    return () => {
      unsub();
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [showOffline, dismiss, flushPushQueue]);

  return (
    <View style={s.root}>
      <AppNavigator />

      {showBanner && (
        <Animated.View
          style={[s.banner, { transform: [{ translateY: slideAnim }] }]}
        >
          <Text style={s.bannerIcon}>⚡</Text>
          <Text style={s.bannerText} numberOfLines={1}>
            No internet — changes will sync when you're back
          </Text>
          <TouchableOpacity onPress={dismiss} style={s.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.closeText}>✕</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#92670a',
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 9999,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  bannerIcon: { fontSize: 15 },
  bannerText: {
    flex: 1,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    paddingHorizontal: 4,
  },
  closeText: {
    color: '#ffffffcc',
    fontSize: 14,
    fontWeight: '700',
  },
});
