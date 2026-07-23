import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { Badge, Tooltip } from '@ant-design/react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { AppShell } from '@/components/app-shell';
import { BottomSheet } from '@/components/bottom-sheet';
import { useApp } from '@/contexts/app-context';
import { useLayoutInsets } from '@/hooks/use-layout-insets';
import { getUnreadMessageCount, loadMessageReadIds, MESSAGES } from '@/lib/messages';
import { uploadUserAvatar } from '@/services/api';
import { components, palette, radii, spacing, typography } from '@/theme';
import type { WeekCheckinDay } from '@/types';

const WEEK_DAYS = ['一', '二', '三', '四', '五', '六', '日'] as const;
const FALLBACK_SIGNED_STREAK = 2;
const BRAND_LOGO = require('../../../assets/images/home-brand-logo.png');
const ASSET_ROWS = [
  { id: 'diary', title: '我的日记', value: '', href: '/my-diary' },
  { id: 'history', title: '历史记录', value: '完成 / 过期 / 废弃', href: '/history' },
  { id: 'settings', title: '设置', value: '', href: '/settings' },
] as const;

const CHECKIN_ACTIVITY_HINT =
  '本周连续签到5天获1次盲盒次数（周一更新，次数仅本周有效）';

type ProfileProgressLike = {
  xpToNextLevel: number;
};

function getNextLevelDynamicHint(progress: ProfileProgressLike) {
  const { xpToNextLevel } = progress;
  if (xpToNextLevel <= 0) {
    return '已达到当前最高等级';
  }

  return `还差 ${xpToNextLevel} XP可升级`;
}

function getCurrentWeekdayIndex() {
  return (new Date().getDay() + 6) % 7;
}

function createFallbackWeekDays(): WeekCheckinDay[] {
  const todayIndex = getCurrentWeekdayIndex();
  const signedStartIndex = Math.max(0, todayIndex - FALLBACK_SIGNED_STREAK + 1);

  return WEEK_DAYS.map((weekday, index) => ({
    date: weekday,
    weekday,
    status: index >= signedStartIndex && index <= todayIndex
      ? 'signed'
      : index < todayIndex
        ? 'failed'
        : 'idle',
    isToday: index === todayIndex,
  }));
}

function showMessage(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
    return;
  }

  Alert.alert(title, message);
}

function formatMembershipExpiry(value: string | null | undefined) {
  if (!value) {
    return '永久有效';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '有效期同步中';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `有效期至 ${year}.${month}.${day}`;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const {
    user,
    isRegistered,
    checkinSummary,
    profileProgress,
    updateAccountProfile,
    refreshCurrentUser,
  } = useApp();
  const { tabBarHeight } = useLayoutInsets();
  const compact = width < 720;
  const nickname = user?.nickname ?? '阿风';
  const avatarSource = user?.avatarUri ? { uri: user.avatarUri } : BRAND_LOGO;
  const fallbackWeekDays = createFallbackWeekDays();
  const weekDays = checkinSummary?.days ?? fallbackWeekDays;
  const signedDays = checkinSummary?.signedDays ?? 0;
  const rewardThreshold = checkinSummary?.rewardThreshold ?? 5;
  const membership = user?.membership;
  const isVip = Boolean(isRegistered && membership?.isVip);
  const weeklyTodoLimit = membership?.weeklyTodoLimit ?? (isVip ? 3 : 1);
  const vipCardTitle = isVip ? 'VIP 奇遇会员' : '开通奇遇会员';
  const vipCardSub = isVip
    ? `${formatMembershipExpiry(membership?.expiresAt)}，本周最多 ${weeklyTodoLimit} 个约定。`
    : `普通用户每周 1 个约定，VIP 每周最多 3 个约定。`;
  const vipActionText = isVip ? '续费' : '充值';
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [nicknameEditorVisible, setNicknameEditorVisible] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [savingNickname, setSavingNickname] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [isUnreadLoading, setIsUnreadLoading] = useState(true);
  const levelText = profileProgress ? `Lv.${profileProgress.level} ${profileProgress.levelName}` : 'Lv.1 城市探索者';
  const nextLevelText = profileProgress
    ? getNextLevelDynamicHint(profileProgress)
    : isRegistered
      ? '登录后可查看成长进度'
      : '登录后可查看成长进度';
  const checkinStatus = isRegistered
    ? checkinSummary
      ? `已签 ${signedDays}/${rewardThreshold} 天，满${rewardThreshold}天获1次盲盒刷新`
      : '同步中'
    : '未登录';

  const userId = user?.id ?? null;
  const refreshUnreadCount = useCallback(async () => {
    setIsUnreadLoading(true);
    const readIds = await loadMessageReadIds(userId);
    setUnreadMessageCount(getUnreadMessageCount(MESSAGES, readIds));
    setIsUnreadLoading(false);
  }, [userId]);

  function openNicknameEditor() {
    if (!isRegistered || !user) {
      router.push('/login');
      return;
    }

    setNicknameError(null);
    setNicknameDraft(nickname);
    setNicknameEditorVisible(true);
  }

  function closeNicknameEditor() {
    setNicknameEditorVisible(false);
    setNicknameError(null);
  }

  async function saveNickname() {
    if (!user || !isRegistered) return;

    const nextNickname = nicknameDraft.trim();
    if (!nextNickname) {
      setNicknameError('昵称不能为空');
      return;
    }

    setSavingNickname(true);
    try {
      await updateAccountProfile({ nickname: nextNickname });
      setNicknameEditorVisible(false);
    } catch (reason) {
      setNicknameError(reason instanceof Error ? reason.message : '保存失败');
    } finally {
      setSavingNickname(false);
    }
  }

  async function handlePickAvatar() {
    if (avatarSaving) return;

    if (!isRegistered || !user) {
      router.push('/login');
      return;
    }

    setAvatarSaving(true);
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          showMessage('无法访问相册', '请在系统设置中允许访问后再试。');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        base64: true,
        mediaTypes: ['images'],
        quality: 0.82,
      } satisfies ImagePicker.ImagePickerOptions);

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      if (!asset?.uri || !asset.base64) {
        throw new Error('未获取到图片内容，请重新选择。');
      }

      const uploaded = await uploadUserAvatar({
        userId: user.id,
        imageBase64: asset.base64,
        mimeType: asset.mimeType ?? 'image/jpeg',
        localUri: asset.uri,
      });
      await updateAccountProfile({ avatarUri: uploaded.avatarUri });
    } catch (reason) {
      showMessage('头像上传失败', reason instanceof Error ? reason.message : '请稍后重试。');
    } finally {
      setAvatarSaving(false);
    }
  }

  function goTo(href: (typeof ASSET_ROWS)[number]['href']) {
    router.push(href);
  }

  function handleAvatarPress() {
    if (!isRegistered) {
      router.push('/login');
      return;
    }

    void handlePickAvatar();
  }

  useEffect(() => {
    queueMicrotask(() => {
      void refreshUnreadCount();
    });
  }, [refreshUnreadCount]);

  useFocusEffect(
    useCallback(() => {
      void refreshUnreadCount();
      if (isRegistered) {
        void refreshCurrentUser();
      }
      return undefined;
    }, [isRegistered, refreshCurrentUser, refreshUnreadCount]),
  );

  return (
    <AppShell>
      <View style={styles.root}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.page,
            { paddingBottom: tabBarHeight + spacing.xl },
          ]}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="懒得动"
            accessibilityRole="button"
            onPress={() => router.push('/about')}
            style={({ pressed }) => [styles.logo, pressed && styles.pressed]}>
            <Image resizeMode="contain" source={BRAND_LOGO} style={styles.logoImage} />
          </Pressable>
          <Pressable
            accessibilityLabel="消息通知"
            accessibilityRole="button"
            onPress={() => router.push('/messages')}
            style={({ pressed }) => [styles.notificationButton, pressed && styles.pressed]}>
            <AppIcon name="bell" size={22} color={palette.ink} />
            {(!isUnreadLoading && unreadMessageCount > 0) ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <View style={[styles.identityCard, compact && styles.identityCardCompact]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="个人信息"
            onPress={handleAvatarPress}
            style={({ pressed }) => [
              styles.avatarButton,
              compact && styles.avatarButtonCompact,
              pressed && styles.pressed,
            ]}>
            <View style={[styles.avatarShadow, compact && styles.avatarShadowCompact]} />
            <View style={[styles.avatarPinTip, compact && styles.avatarPinTipCompact]} />
            <View style={[styles.avatarFrame, compact && styles.avatarFrameCompact]}>
              <View style={styles.avatarImageMask}>
                <Image
                  accessibilityLabel="头像"
                  resizeMode={user?.avatarUri ? 'cover' : 'contain'}
                  source={avatarSource}
                  style={[styles.avatarImage, !user?.avatarUri && styles.avatarLogoImage]}
                />
              </View>
            </View>
          </Pressable>
            <View style={[styles.identityCopy, compact && styles.identityCopyCompact]}>
              <View style={styles.nicknameRow}>
                <Badge
                  text={isVip ? 'VIP' : undefined}
                  style={styles.nicknameBadgeAnchor}
                  styles={{
                    textDom: StyleSheet.flatten([
                      styles.memberBadge,
                      compact && styles.memberBadgeCompact,
                    ]),
                    text: styles.memberBadgeText,
                  }}>
                  <Text
                    style={[styles.nickname, compact && styles.nicknameCompact]}
                    numberOfLines={1}
                    ellipsizeMode="tail">
                    {isRegistered ? nickname : '阿风'}
                  </Text>
                </Badge>
              <Pressable
                accessibilityLabel="修改昵称"
                accessibilityRole="button"
                disabled={!isRegistered}
                onPress={() => void openNicknameEditor()}
                style={({ pressed }) => [styles.nicknameEditButton, pressed && styles.pressed]}>
                <AppIcon
                  name="edit"
                  size={compact ? 18 : 20}
                  color={palette.primary}
                  style={styles.nicknameEditIcon}
                />
              </Pressable>
            </View>
            <View style={[styles.levelTitleRow, compact && styles.levelTitleRowCompact]}>
              <View style={[styles.levelPill, compact && styles.levelPillCompact]}>
                <Text style={[styles.levelText, compact && styles.levelTextCompact]}>
                  {levelText}
                </Text>
              </View>
            </View>
            <View style={styles.levelHintRow}>
              <Text
                style={[styles.levelHint, compact && styles.levelHintCompact]}
                numberOfLines={1}
                ellipsizeMode="tail">
                {nextLevelText}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.checkinCard, compact && styles.checkinCardCompact]}>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadLeft}>
              <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>本周签到</Text>
              <Tooltip
                content={
                  <Text style={[styles.checkinTooltipText, compact && styles.checkinTooltipTextCompact]}>
                    {CHECKIN_ACTIVITY_HINT}
                  </Text>
                }
                styles={{
                  tooltip: styles.checkinTooltip,
                }}
                trigger="onPress"
                placement="top">
                <View accessibilityLabel="签到说明" accessibilityRole="button">
                  <AppIcon name="info" size={16} color={palette.muted} />
                </View>
              </Tooltip>
            </View>
            <Text
              style={[styles.checkinStatusText, compact && styles.checkinStatusTextCompact]}
              numberOfLines={1}
              ellipsizeMode="tail">
              {checkinStatus}
            </Text>
          </View>
          <View style={styles.weekGrid}>
            {weekDays.map((day, index) => {
              const signed = day.status === 'signed';
              const weekday = WEEK_DAYS[index] ?? day.weekday.replace('周', '');
              return (
                <View
                  key={day.date}
                  style={[
                    styles.dayBox,
                    compact && styles.dayBoxCompact,
                    signed && styles.dayBoxSigned,
                    day.isToday && styles.dayBoxToday,
                  ]}>
                  {signed ? (
                    <AppIcon
                      name="check"
                      size={compact ? 16 : 22}
                      color={day.isToday ? palette.primaryDark : palette.primary}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.dayText,
                        compact && styles.dayTextCompact,
                        day.isToday && styles.dayTextToday,
                      ]}>
                      {weekday}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/vip')}
          style={({ pressed }) => [styles.vipCard, compact && styles.vipCardCompact, pressed && styles.pressed]}>
          <View style={styles.vipGlowCool} />
          <View style={styles.vipGlowWarm} />
          <View style={styles.vipCopy}>
            <Text style={[styles.vipTitle, compact && styles.vipTitleCompact]}>{vipCardTitle}</Text>
            <Text style={[styles.vipSub, compact && styles.vipSubCompact]}>
              {vipCardSub}
            </Text>
          </View>
          <View style={[styles.chargeButton, compact && styles.chargeButtonCompact]}>
            <Text style={[styles.chargeText, compact && styles.chargeTextCompact]}>{vipActionText}</Text>
          </View>
        </Pressable>

        <View style={[styles.assetList, compact && styles.assetListCompact]}>
          {ASSET_ROWS.map((row, index) => (
            <Pressable
              accessibilityRole="button"
              key={row.id}
              onPress={() => goTo(row.href)}
              style={({ pressed }) => [
                styles.assetRow,
                compact && styles.assetRowCompact,
                index < ASSET_ROWS.length - 1 && styles.assetRowBorder,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.assetTitle, compact && styles.assetTitleCompact]}>{row.title}</Text>
              <View style={styles.assetMeta}>
                {row.value ? (
                  <Text style={[styles.assetValue, compact && styles.assetValueCompact]}>{row.value}</Text>
                ) : null}
                <Text style={[styles.assetArrow, compact && styles.assetArrowCompact]}>›</Text>
              </View>
            </Pressable>
          ))}
        </View>

        </ScrollView>

        <BottomSheet
          onClose={closeNicknameEditor}
          title="编辑昵称"
          visible={nicknameEditorVisible}>
          <View style={styles.nicknameEditor}>
            <Text style={styles.nicknameEditorLabel}>昵称</Text>
            <TextInput
              autoFocus
              maxLength={16}
              onChangeText={(value) => {
                setNicknameDraft(value);
                setNicknameError(null);
              }}
              placeholder="请输入昵称"
              placeholderTextColor={palette.placeholder}
              style={styles.nicknameEditorInput}
              value={nicknameDraft}
            />
            {nicknameError ? <Text style={styles.nicknameEditorError}>{nicknameError}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={savingNickname}
              onPress={() => void saveNickname()}
              style={({ pressed }) => [
                styles.nicknameEditorSave,
                (pressed || savingNickname) && styles.pressed,
              ]}>
              <Text style={styles.nicknameEditorSaveText}>{savingNickname ? '保存中' : '保存'}</Text>
            </Pressable>
          </View>
        </BottomSheet>
      </View>
    </AppShell>
  );
}

const cardShadow = Platform.select({
  web: { boxShadow: '0 18px 46px rgba(98, 82, 192, 0.13)' },
  default: {
    shadowColor: '#6252C0',
    shadowOpacity: 0.13,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
  },
});

const PROFILE_CARD_GRADIENT =
  'linear-gradient(135deg, #FDF2CF 0%, #F6EEED 33%, #F3ECF9 67%, #DDF7FF 100%)';

const vipGradient = Platform.select({
  web: {
    backgroundImage: PROFILE_CARD_GRADIENT,
  } as Record<string, string>,
  default: {},
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F0EEFF',
  },
  page: {
    paddingHorizontal: 8,
    gap: 12,
  },
  topBar: {
    height: components.topBarHeight + 24,
    marginHorizontal: -8,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    width: 76,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 76,
    height: 50,
  },
  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  notificationBadge: {
    position: 'absolute',
    right: 6,
    top: 6,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
  },
  notificationBadgeText: {
    color: palette.white,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
  },
  identityCard: {
    minHeight: 0,
    paddingHorizontal: 0,
    paddingTop: 2,
    paddingBottom: 8,
    marginTop: -68,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  identityCardCompact: {
    minHeight: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 6,
    marginTop: -60,
  },
  avatarButton: {
    width: 132,
    height: 154,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarButtonCompact: {
    width: 106,
    height: 126,
  },
  avatarFrame: {
    position: 'relative',
    zIndex: 2,
    width: 122,
    height: 122,
    borderRadius: 61,
    padding: 7,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    ...cardShadow,
  },
  avatarFrameCompact: {
    width: 98,
    height: 98,
    borderRadius: 49,
    padding: 6,
  },
  avatarImageMask: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: palette.skySoft,
  },
  avatarPinTip: {
    position: 'absolute',
    zIndex: 1,
    bottom: 20,
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: palette.white,
    transform: [{ rotate: '45deg' }],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  avatarPinTipCompact: {
    bottom: 17,
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  avatarShadow: {
    position: 'absolute',
    bottom: 7,
    width: 88,
    height: 20,
    borderRadius: 999,
    backgroundColor: 'rgba(117,101,246,0.16)',
  },
  avatarShadowCompact: {
    bottom: 6,
    width: 72,
    height: 16,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarLogoImage: {
    width: '86%',
    height: '86%',
  },
  identityCopy: {
    width: '100%',
    minWidth: 0,
    marginTop: 8,
    alignItems: 'center',
  },
  identityCopyCompact: {
    marginTop: 4,
  },
  nicknameRow: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nicknameEditButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  nickname: {
    flexShrink: 1,
    color: palette.ink,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    textAlign: 'center',
  },
  nicknameCompact: {
    fontSize: typography.h1,
    lineHeight: 30,
  },
  nicknameEditIcon: {
    flexShrink: 0,
  },
  nicknameBadgeAnchor: {
    position: 'relative',
    maxWidth: '100%',
    flexShrink: 1,
  },
  memberBadge: {
    position: 'absolute',
    right: -24,
    top: -7,
    minWidth: 34,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
    borderWidth: 1,
    borderColor: palette.white,
  },
  memberBadgeCompact: {
    right: -22,
    top: -6,
    minWidth: 30,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 6,
  },
  memberBadgeText: {
    color: palette.white,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
  },
  nicknameEditor: {
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  nicknameEditorLabel: {
    color: palette.ink,
    fontSize: typography.body,
    lineHeight: 20,
    fontWeight: '900',
  },
  nicknameEditorInput: {
    minHeight: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: typography.body,
    color: palette.ink,
    backgroundColor: palette.paper,
  },
  nicknameEditorError: {
    color: palette.error,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  nicknameEditorSave: {
    marginTop: spacing.xs,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
  },
  nicknameEditorSaveText: {
    color: palette.white,
    fontWeight: '900',
  },
  levelPill: {
    alignSelf: 'center',
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: palette.primary,
  },
  levelPillCompact: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  levelText: {
    color: palette.white,
    fontSize: typography.label,
    lineHeight: 15,
    fontWeight: '900',
  },
  levelTextCompact: {
    fontSize: typography.label,
    lineHeight: 15,
  },
  levelHint: {
    color: '#8D85AD',
    maxWidth: 320,
    fontSize: typography.body,
    lineHeight: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  levelHintCompact: {
    fontSize: typography.caption,
    lineHeight: 18,
  },
  levelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  levelTitleRowCompact: {
    marginTop: 9,
  },
  levelHintRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  checkinCard: {
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    backgroundColor: palette.white,
    ...cardShadow,
  },
  checkinCardCompact: {
    borderRadius: 26,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardHeadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    flexShrink: 1,
    color: palette.ink,
    fontSize: typography.h1,
    lineHeight: 30,
    fontWeight: '900',
  },
  sectionTitleCompact: {
    fontSize: typography.h2,
    lineHeight: 28,
  },
  checkinStatusText: {
    flex: 1,
    color: palette.primaryDark,
    textAlign: 'right',
    paddingLeft: spacing.md,
    fontSize: typography.label,
    lineHeight: 18,
    fontWeight: '900',
  },
  checkinStatusTextCompact: {
    fontSize: typography.caption,
    lineHeight: 16,
  },
  checkinTooltip: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 220,
    maxWidth: 260,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  checkinTooltipText: {
    color: palette.muted,
    fontSize: typography.caption,
    lineHeight: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  checkinTooltipTextCompact: {
    fontSize: typography.label,
    lineHeight: 16,
    textAlign: 'center',
  },
  weekGrid: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  dayBox: {
    flex: 1,
    aspectRatio: 1,
    minWidth: 0,
    maxWidth: 70,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(117,101,246,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248,247,255,0.78)',
  },
  dayBoxCompact: {
    borderRadius: 999,
    maxWidth: 42,
  },
  dayBoxSigned: {
    borderColor: palette.primaryLight,
    backgroundColor: palette.primarySoft,
  },
  dayBoxToday: {
    borderWidth: 3,
    borderColor: palette.primaryDark,
    backgroundColor: palette.white,
  },
  dayText: {
    color: palette.muted,
    fontSize: typography.h3,
    lineHeight: 22,
    fontWeight: '900',
  },
  dayTextCompact: {
    fontSize: typography.body,
    lineHeight: 20,
  },
  dayTextToday: {
    color: palette.ink,
  },
  vipCard: {
    position: 'relative',
    minHeight: 166,
    borderRadius: 36,
    paddingHorizontal: 24,
    paddingVertical: 24,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: '#F3ECF9',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    ...vipGradient,
    ...cardShadow,
  },
  vipCardCompact: {
    minHeight: 112,
    borderRadius: 26,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  vipGlowCool: {
    position: 'absolute',
    right: -36,
    bottom: -36,
    width: 252,
    height: 232,
    borderRadius: 126,
    backgroundColor: 'rgba(112, 225, 230, 0.04)',
  },
  vipGlowWarm: {
    position: 'absolute',
    left: -34,
    top: -46,
    width: 236,
    height: 220,
    borderRadius: 118,
    backgroundColor: 'rgba(255, 220, 123, 0.04)',
  },
  vipCopy: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    zIndex: 1,
    paddingRight: 22,
  },
  vipTitle: {
    color: '#8D85AD',
    fontSize: typography.h1,
    lineHeight: 30,
    fontWeight: '900',
  },
  vipTitleCompact: {
    fontSize: typography.h2,
    lineHeight: 24,
  },
  vipSub: {
    marginTop: 16,
    maxWidth: 420,
    color: '#8D85AD',
    fontSize: typography.body,
    lineHeight: 22,
    fontWeight: '900',
  },
  vipSubCompact: {
    marginTop: 8,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  chargeButton: {
    position: 'relative',
    zIndex: 1,
    width: 112,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: '#9F91F4',
  },
  chargeButtonCompact: {
    width: 70,
    height: 50,
    borderRadius: 25,
  },
  chargeText: {
    color: palette.white,
    fontSize: typography.h2,
    lineHeight: 24,
    fontWeight: '900',
  },
  chargeTextCompact: {
    fontSize: typography.h3,
    lineHeight: 22,
  },
  assetList: {
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.9)',
    ...cardShadow,
  },
  assetListCompact: {
    borderRadius: 24,
  },
  assetRow: {
    minHeight: 78,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
  },
  assetRowCompact: {
    minHeight: 58,
    paddingHorizontal: 18,
  },
  assetRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E2FA',
  },
  assetTitle: {
    flexShrink: 0,
    color: '#8D85AD',
    fontSize: typography.h3,
    lineHeight: 22,
    fontWeight: '900',
  },
  assetTitleCompact: {
    fontSize: typography.body,
    lineHeight: 20,
  },
  assetMeta: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  assetValue: {
    flexShrink: 1,
    color: '#8D85AD',
    fontSize: typography.body,
    lineHeight: 20,
    fontWeight: '900',
    textAlign: 'right',
  },
  assetValueCompact: {
    fontSize: typography.caption,
    lineHeight: 18,
  },
  assetArrow: {
    color: '#8D85AD',
    fontSize: typography.h1,
    lineHeight: 28,
    fontWeight: '900',
  },
  assetArrowCompact: {
    fontSize: typography.h2,
    lineHeight: 24,
  },
  pressed: {
    opacity: 0.78,
  },
});
