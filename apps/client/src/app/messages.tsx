import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { AppIcon } from '@/components/app-icon';
import { AppShell } from '@/components/app-shell';
import { InnerPageHeader } from '@/components/inner-page-header';
import { useApp } from '@/contexts/app-context';
import { useLayoutInsets } from '@/hooks/use-layout-insets';
import {
  type MessageTab,
  MESSAGE_TABS,
  MESSAGES,
  getUnreadMessageCount,
  loadMessageReadIds,
  matchesMessageTab,
  saveMessageReadIds,
} from '@/lib/messages';
import { backOrReplace } from '@/lib/safe-return-to';
import { palette, radii, shadows, spacing, typography } from '@/theme';

export default function MessagesScreen() {
  const router = useRouter();
  const insets = useLayoutInsets();
  const { user } = useApp();
  const [activeTab, setActiveTab] = useState<MessageTab>('全部');
  const [readIds, setReadIds] = useState<string[]>([]);
  const [isLoadingReadIds, setIsLoadingReadIds] = useState(true);

  const userId = user?.id ?? null;

  const unreadCount = getUnreadMessageCount(MESSAGES, readIds);
  const visibleMessages = useMemo(
    () => MESSAGES.filter((message) => matchesMessageTab(activeTab, message, readIds)),
    [activeTab, readIds],
  );
  const pageMaxWidth = insets.isWebDesktop ? 520 : 430;

  const loadReadState = useCallback(async () => {
    setIsLoadingReadIds(true);
    const loadedReadIds = await loadMessageReadIds(userId);
    setReadIds(loadedReadIds);
    setIsLoadingReadIds(false);
  }, [userId]);

  const markRead = useCallback(
    (messageId: string) => {
      setReadIds((current) => {
        if (current.includes(messageId)) {
          return current;
        }
        const next = [...current, messageId];
        void saveMessageReadIds(userId, next);
        return next;
      });
    },
    [userId],
  );

  function markAllRead() {
    const next = [...new Set(MESSAGES.map((message) => message.id))];
    setReadIds(next);
    void saveMessageReadIds(userId, next);
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadReadState();
    });
  }, [loadReadState]);

  useFocusEffect(
    useCallback(() => {
      void loadReadState();
      return undefined;
    }, [loadReadState]),
  );

  return (
    <AppShell>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.page,
            {
              maxWidth: pageMaxWidth,
              paddingBottom: insets.bottom + spacing['2xl'],
            },
          ]}
          showsVerticalScrollIndicator={false}>
          <InnerPageHeader title="消息通知" onBack={() => backOrReplace(router, '/profile')} />

          <View style={styles.summary}>
            <View>
              <Text style={styles.summaryTitle}>{unreadCount > 0 ? `${unreadCount} 条未读消息` : '暂无未读消息'}</Text>
              {isLoadingReadIds ? <Text style={styles.summaryLoading}>读取中...</Text> : null}
              <Text style={styles.summarySub}>约定、日记和系统提醒都会放在这里。</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={unreadCount === 0}
              onPress={markAllRead}
              style={({ pressed }) => [
                styles.readAllButton,
                unreadCount === 0 && styles.readAllButtonDisabled,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.readAllText, unreadCount === 0 && styles.readAllTextDisabled]}>全部已读</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {MESSAGE_TABS.map((tab) => {
              const active = activeTab === tab;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[styles.tab, active && styles.tabActive]}>
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {visibleMessages.length > 0 ? (
            <View style={styles.messageList}>
              {visibleMessages.map((message) => {
                const unread = message.unread && !readIds.includes(message.id);
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={message.id}
                    onPress={() => markRead(message.id)}
                    style={({ pressed }) => [styles.messageRow, pressed && styles.pressed]}>
                    <View style={[styles.messageIcon, unread && styles.messageIconUnread]}>
                      <AppIcon name={message.icon} size={18} color={unread ? palette.primary : palette.muted} />
                    </View>
                    <View style={styles.messageBody}>
                      <View style={styles.messageTitleRow}>
                        <Text style={styles.messageTitle} numberOfLines={1}>{message.title}</Text>
                        <Text style={styles.messageTime}>{message.time}</Text>
                      </View>
                    <Text style={styles.messageText} numberOfLines={2}>{message.body}</Text>
                    </View>
                    {unread ? <View style={styles.unreadDot} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.empty}>
              <AppIcon name="bell" size={34} color={palette.muted} />
              <Text style={styles.emptyTitle}>这个分类还没有消息</Text>
              <Text style={styles.emptyText}>新的提醒出现后，会自动同步到这里。</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  page: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  summary: {
    minHeight: 92,
    borderRadius: radii.lg,
    padding: spacing.lg,
    backgroundColor: palette.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    ...shadows.card,
  },
  summaryTitle: {
    color: palette.ink,
    fontSize: typography.h2,
    lineHeight: 28,
    fontWeight: '900',
  },
  summarySub: {
    color: palette.muted,
    fontSize: typography.caption,
    lineHeight: 18,
    marginTop: 4,
  },
  summaryLoading: {
    color: palette.muted,
    marginTop: 4,
    fontSize: typography.caption,
    lineHeight: 16,
  },
  readAllButton: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: palette.primary,
  },
  readAllButtonDisabled: {
    backgroundColor: palette.primarySoft,
  },
  readAllText: {
    color: palette.white,
    fontSize: typography.caption,
    lineHeight: 16,
    fontWeight: '900',
  },
  readAllTextDisabled: {
    color: palette.primary,
  },
  tabs: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tab: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  tabActive: {
    backgroundColor: palette.primarySoft,
    borderColor: palette.primary,
  },
  tabText: {
    color: palette.text,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  tabTextActive: {
    color: palette.primary,
    fontWeight: '900',
  },
  messageList: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: palette.surface,
    ...shadows.card,
  },
  messageRow: {
    minHeight: 86,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  messageIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.paper,
  },
  messageIconUnread: {
    backgroundColor: palette.primarySoft,
  },
  messageBody: {
    flex: 1,
    minWidth: 0,
  },
  messageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  messageTitle: {
    flex: 1,
    color: palette.ink,
    fontSize: typography.body,
    lineHeight: 22,
    fontWeight: '900',
  },
  messageTime: {
    color: palette.muted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  messageText: {
    color: palette.muted,
    fontSize: typography.caption,
    lineHeight: 19,
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.primary,
  },
  empty: {
    minHeight: 180,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: palette.surface,
    ...shadows.card,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: typography.body,
    fontWeight: '900',
    marginTop: spacing.md,
  },
  emptyText: {
    color: palette.muted,
    fontSize: typography.caption,
    lineHeight: 18,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.78,
  },
});
