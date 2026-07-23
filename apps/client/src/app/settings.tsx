import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { AppShell } from '@/components/app-shell';
import { BackImageButton } from '@/components/back-image-button';
import { BottomSheet } from '@/components/bottom-sheet';
import { useApp } from '@/contexts/app-context';
import { useLayoutInsets } from '@/hooks/use-layout-insets';
import { confirmDialog } from '@/lib/confirm-dialog';
import { backOrReplace } from '@/lib/safe-return-to';
import { components, palette, radii, shadows, spacing, typography } from '@/theme';

type LocationPermission = 'once' | 'whileUsing' | 'always';

const LOCATION_OPTIONS: { label: string; value: LocationPermission }[] = [
  { label: '仅使用一次', value: 'once' },
  { label: '打开App时允许', value: 'whileUsing' },
  { label: '始终允许', value: 'always' },
];

const screenGradient =
  Platform.OS === 'web'
    ? ({
        backgroundImage: `linear-gradient(138deg, ${palette.skySoft} 0%, ${palette.canvas} 48%, ${palette.duneSoft} 100%)`,
      } as unknown as ViewStyle)
    : null;

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useLayoutInsets();
  const { width } = useWindowDimensions();
  const { logout } = useApp();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [heartReminderEnabled, setHeartReminderEnabled] = useState(true);
  const [diaryPublicEnabled, setDiaryPublicEnabled] = useState(false);
  const [locationPermission, setLocationPermission] = useState<LocationPermission>('whileUsing');
  const [locationSheetVisible, setLocationSheetVisible] = useState(false);

  const isCompact = width < 340;
  const pageMaxWidth = insets.isWebDesktop ? 520 : 430;
  const horizontalPadding = isCompact ? spacing.md : spacing.lg;
  const locationPermissionLabel =
    LOCATION_OPTIONS.find((option) => option.value === locationPermission)?.label ?? '打开App时允许';

  async function handleLogout() {
    const confirmed = await confirmDialog(
      '退出登录',
      '退出后需要重新登录才能继续使用，你的账号数据仍保存在云端。',
      '退出',
    );
    if (!confirmed) return;

    try {
      await logout();
      router.replace('/login');
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '退出登录失败';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('退出失败', message);
      }
    }
  }

  return (
    <AppShell>
      <View style={[styles.screen, screenGradient]}>
        <ScrollView
          contentContainerStyle={[
            styles.page,
            {
              maxWidth: pageMaxWidth,
              paddingHorizontal: horizontalPadding,
              paddingBottom: insets.bottom + spacing['2xl'],
            },
          ]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <BackImageButton onPress={() => backOrReplace(router, '/profile')} />
          </View>

          <View style={styles.groupCard}>
            <SettingsRow label="账号与安全" onPress={() => router.push('/account-security')} />
            <SettingsRow
              label="通知提醒"
              control={
                <SettingSwitch
                  enabled={notificationsEnabled}
                  onPress={() => setNotificationsEnabled((value) => !value)}
                />
              }
            />
            <SettingsRow
              label="心动约定提醒"
              control={
                <SettingSwitch
                  enabled={heartReminderEnabled}
                  onPress={() => setHeartReminderEnabled((value) => !value)}
                />
              }
            />
            <SettingsRow
              label="日记默认公开"
              control={
                <SettingSwitch
                  enabled={diaryPublicEnabled}
                  onPress={() => setDiaryPublicEnabled((value) => !value)}
                />
              }
            />
            <SettingsRow
              isLast
              label="位置权限"
              value={locationPermissionLabel}
              onPress={() => setLocationSheetVisible(true)}
            />
          </View>

          <View style={styles.groupCard}>
            <SettingsRow label="用户协议" onPress={() => router.push('/user-agreement')} />
            <SettingsRow label="隐私政策" onPress={() => router.push('/privacy-policy')} />
            <SettingsRow label="退出登录" onPress={() => void handleLogout()} isLast />
          </View>
        </ScrollView>
      </View>

      <BottomSheet
        onClose={() => setLocationSheetVisible(false)}
        title="位置权限"
        visible={locationSheetVisible}>
        <View style={styles.sheetList}>
          {LOCATION_OPTIONS.map((option) => {
            const selected = option.value === locationPermission;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={option.value}
                onPress={() => {
                  setLocationPermission(option.value);
                  setLocationSheetVisible(false);
                }}
                style={({ pressed }) => [
                  styles.choiceRow,
                  selected && styles.choiceRowActive,
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.choiceText, selected && styles.choiceTextActive]}>
                  {option.label}
                </Text>
                {selected ? <AppIcon name="check" size={16} color={palette.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </AppShell>
  );
}

function SettingsRow({
  label,
  value,
  control,
  isLast = false,
  onPress,
}: {
  label: string;
  value?: string;
  control?: React.ReactNode;
  isLast?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? (
          <Text numberOfLines={1} style={styles.rowValue}>
            {value}
          </Text>
        ) : null}
        {control ?? (
          <View style={styles.arrowIcon}>
            <AppIcon name="arrow-right" size={15} color={palette.ink} />
          </View>
        )}
      </View>
    </>
  );

  if (!onPress) {
    return <View style={[styles.row, !isLast && styles.rowDivider]}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, !isLast && styles.rowDivider, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

function SettingSwitch({ enabled, onPress }: { enabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.switchTrack,
        enabled && styles.switchTrackOn,
        pressed && styles.pressed,
      ]}>
      <View style={[styles.switchThumb, enabled && styles.switchThumbOn]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    position: 'relative',
    backgroundColor: palette.canvas,
  },
  page: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingTop: 0,
    gap: spacing.lg,
  },
  header: {
    minHeight: components.topBarHeight - 2,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
  },
  groupCard: {
    overflow: 'hidden',
    borderRadius: radii['2xl'],
    backgroundColor: palette.white,
    ...shadows.card,
  },
  row: {
    width: '100%',
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
    color: palette.ink,
    fontSize: typography.body,
    lineHeight: 20,
    fontWeight: '900',
  },
  rowRight: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    maxWidth: '58%',
    flexShrink: 1,
  },
  rowValue: {
    minWidth: 0,
    flexShrink: 1,
    color: palette.ink,
    fontSize: typography.body,
    lineHeight: 20,
    fontWeight: '400',
  },
  arrowIcon: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  switchTrack: {
    width: 42,
    height: 24,
    borderRadius: radii.pill,
    backgroundColor: palette.contour,
    padding: 3,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  switchTrackOn: {
    backgroundColor: palette.primary,
  },
  switchThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.white,
  },
  switchThumbOn: {
    transform: [{ translateX: 18 }],
  },
  sheetList: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  choiceRow: {
    width: '100%',
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.paper,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    overflow: 'hidden',
  },
  choiceRowActive: {
    borderColor: palette.primaryLight,
    backgroundColor: palette.primarySoft,
  },
  choiceText: {
    flex: 1,
    minWidth: 0,
    color: palette.text,
    fontSize: typography.body,
    lineHeight: 20,
    fontWeight: '400',
  },
  choiceTextActive: {
    color: palette.primaryDark,
    fontWeight: '400',
  },
  pressed: {
    opacity: 0.78,
  },
});
