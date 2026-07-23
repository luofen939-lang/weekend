import { Provider as AntdProvider } from '@ant-design/react-native';
import { Stack, usePathname, useRootNavigationState, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { antdTheme } from '@/antd-theme';
import { DeviceProfileSync } from '@/components/device-profile-sync';
import { AppProvider, useApp } from '@/contexts/app-context';
import { store } from '@/store';
import { palette } from '@/theme';

const publicPaths = new Set(['/login', '/register', '/user-agreement', '/privacy-policy']);

function AuthGate() {
  const router = useRouter();
  const pathname = usePathname();
  const rootNavigationState = useRootNavigationState();
  const { isBooting, isRegistered } = useApp();

  useEffect(() => {
    if (!rootNavigationState?.key || isBooting || isRegistered || publicPaths.has(pathname)) {
      return;
    }

    router.replace(`/login?returnTo=${encodeURIComponent(pathname)}` as Href);
  }, [isBooting, isRegistered, pathname, rootNavigationState?.key, router]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AntdProvider theme={antdTheme}>
        <ReduxProvider store={store}>
          <AppProvider>
            <AuthGate />
            <DeviceProfileSync />
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: palette.canvas },
                animation: 'slide_from_right',
              }}>
              {/* 主 Tab 导航 */}
              <Stack.Screen name="(tabs)" />
              {/* 流程 / 详情页（Stack push 展示，无底部 Tab） */}
              <Stack.Screen name="preferences" />
              <Stack.Screen name="map" />
              <Stack.Screen name="draw" />
              <Stack.Screen name="activity/[id]" />
              <Stack.Screen name="diary/[id]" />
              <Stack.Screen name="favorites" />
              <Stack.Screen name="about" />
              <Stack.Screen name="login" />
              <Stack.Screen name="register" />
              <Stack.Screen name="semantic-search" />
              <Stack.Screen name="travel-preferences" />
              <Stack.Screen name="ai-recommend" />
              <Stack.Screen name="ai-trip" />
              <Stack.Screen name="result-card" />
              <Stack.Screen name="plan-detail" />
              <Stack.Screen name="join-plan" />
              <Stack.Screen name="complete-checkin" />
              <Stack.Screen name="review-status" />
              <Stack.Screen name="weekly-empty" />
              <Stack.Screen name="vip" />
              <Stack.Screen name="my-diary" />
              <Stack.Screen name="invite" />
              <Stack.Screen name="history" />
              <Stack.Screen name="messages" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="account-security" />
              <Stack.Screen name="user-agreement" />
              <Stack.Screen name="privacy-policy" />
            </Stack>
          </AppProvider>
        </ReduxProvider>
      </AntdProvider>
    </SafeAreaProvider>
  );
}
