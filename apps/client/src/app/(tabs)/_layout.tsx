import { Redirect, Tabs, usePathname, type Href } from 'expo-router';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';

import { bottomTabIcons, type BottomTabId } from '@/constants/bottom-tab-icons';
import { useApp } from '@/contexts/app-context';
import { useLayoutInsets } from '@/hooks/use-layout-insets';
import { components, palette, shadows } from '@/theme';

const TAB_HORIZONTAL_INSET = 12;

function TabBarBackground() {
  return <View style={[styles.tabBarPill, shadows.tabBar]} />;
}

function TabIcon({
  name,
  label,
  focused,
}: {
  name: BottomTabId;
  label: string;
  focused: boolean;
}) {
  const source = bottomTabIcons[name][focused ? 'active' : 'inactive'];

  return (
    <View style={styles.tabContent}>
      <Image resizeMode="contain" source={source} style={styles.iconImage} />
      <Text numberOfLines={1} style={[styles.iconLabel, focused && styles.iconLabelActive]}>
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const layout = useLayoutInsets();
  const pathname = usePathname();
  const { isBooting, isRegistered } = useApp();
  const floatGap = components.bottomTabFloatGap;
  const barHeight = components.bottomTabHeight;
  const tabBarBottom = layout.bottom + floatGap;

  if (isBooting) {
    return <View style={styles.authLoading} />;
  }

  if (!isRegistered) {
    return <Redirect href={`/login?returnTo=${encodeURIComponent(pathname)}` as Href} />;
  }

  return (
    <Tabs
      safeAreaInsets={{ top: 0, left: 0, right: 0, bottom: 0 }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.muted,
        tabBarBackground: TabBarBackground,
        tabBarShowLabel: false,
        tabBarStyle: [
          styles.tabBarContainer,
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: tabBarBottom,
            height: barHeight,
            marginHorizontal: TAB_HORIZONTAL_INSET,
            zIndex: 10,
          },
        ],
        tabBarItemStyle: styles.tabItem,
        tabBarIconStyle: styles.tabIconSlot,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ focused }) => <TabIcon name="home" label="首页" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="draw"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="todos"
        options={{
          title: '本周约定',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="todos" label="本周约定" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ focused }) => <TabIcon name="profile" label="我的" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  authLoading: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  tabBarContainer: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
    paddingTop: 0,
    paddingBottom: 0,
    ...(Platform.OS === 'web'
      ? { boxShadow: 'none' as const, pointerEvents: 'box-none' as const }
      : {}),
  },
  tabBarPill: {
    ...StyleSheet.absoluteFill,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  tabItem: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 0,
  },
  tabIconSlot: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    marginBottom: 0,
  },
  tabContent: {
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  iconImage: {
    width: 24,
    height: 24,
  },
  iconLabel: {
    color: palette.muted,
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 12,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  iconLabelActive: {
    color: palette.primary,
  },
});
