import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { AppThemeProvider } from '@/theme/ThemeProvider';
import { ToastHost } from '@/components/ui/Toast';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/authStore';
import { useNetworkStore } from '@/stores/networkStore';
import { useUIStore } from '@/stores/uiStore';
import { useSyncStore } from '@/stores/syncStore';
import { useNetworkStatus } from '@/hooks/useAuth';

void SplashScreen.preventAutoHideAsync().catch(() => {});

/** Replays the offline outbox whenever connectivity returns. */
function OutboxFlusher() {
  useNetworkStatus();
  return null;
}

function InnerLayout() {
  const theme = useTheme();
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const status = useAuthStore((s) => s.status);
  const startListening = useNetworkStore((s) => s.startListening);
  const loadPersistedUi = useUIStore((s) => s.loadPersistedUi);

  useEffect(() => {
    void bootstrap();
    void loadPersistedUi();
    return startListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== 'booting') {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [status]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar
        style={theme.mode === 'dark' ? 'light' : 'dark'}
        animated
      />
      <OutboxFlusher />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="project/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Protected guard={status === 'authenticated'}>
          <Stack.Screen name="camera" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="media-viewer" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="workers/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="contacts/index" options={{ title: 'Contacts', animation: 'slide_from_right' }} />
          <Stack.Screen name="modal/expense" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="modal/worker" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="modal/task" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="modal/material" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="modal/report" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />

          {/* ERP expansion modals */}
          <Stack.Screen name="modal/customer" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="modal/lead" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="modal/booking" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="modal/payment" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="modal/unit" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="modal/vendor" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="modal/purchase-order" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="modal/equipment" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="modal/document" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="modal/milestone" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="modal/contractor" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack.Protected>
      </Stack>
      <ToastHost />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <InnerLayout />
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
