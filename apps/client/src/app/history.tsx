import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ErrorCard } from '@/components/error-card';
import { BackImageButton } from '@/components/back-image-button';
import { useApp } from '@/contexts/app-context';
import { useLayoutInsets } from '@/hooks/use-layout-insets';
import { backOrReplace } from '@/lib/safe-return-to';
import { getHistoryRecords } from '@/services/api';
import { components, palette, radii, shadows, spacing, typography } from '@/theme';
import type { HistoryItem } from '@/types';

type HistoryFilter = 'all' | HistoryItem['status'];

const FILTERS: { key: HistoryFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'completed', label: '已完成' },
  { key: 'expired', label: '已过期' },
  { key: 'abandoned', label: '已废弃' },
];

const STATUS_LABELS: Record<HistoryItem['status'], string> = {
  completed: '已完成',
  expired: '已过期',
  abandoned: '已废弃',
};

const STATUS_COLUMN_WIDTH = components.chipHeight + spacing['3xl'];

const screenGradient =
  Platform.OS === 'web'
    ? ({
        backgroundImage: `linear-gradient(138deg, ${palette.skySoft} 0%, ${palette.canvas} 48%, ${palette.duneSoft} 100%)`,
      } as unknown as ViewStyle)
    : null;

function toCardDate(value: string) {
  if (!value) return '—';
  return value.includes('.') ? value : value.replace(/-/g, '.');
}

export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useApp();
  const insets = useLayoutInsets();
  const { width } = useWindowDimensions();
  const [selectedFilter, setSelectedFilter] = useState<HistoryFilter>('all');
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isCompact = width < 340;
  const pageMaxWidth = insets.isWebDesktop ? 520 : 430;
  const horizontalPadding = isCompact ? spacing.md : spacing.lg;

  const loadHistory = useCallback(async () => {
    if (!user) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    setError(null);
    try {
      setItems(await getHistoryRecords(user.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '历史记录加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadHistory();
    });
  }, [loadHistory]);

  const visibleItems = useMemo(() => {
    if (selectedFilter === 'all') {
      return items;
    }

    return items.filter((item) => item.status === selectedFilter);
  }, [items, selectedFilter]);

  const filterCounts = useMemo(() => {
    return items.reduce(
      (counts, item) => {
        counts.all += 1;
        counts[item.status] += 1;
        return counts;
      },
      { all: 0, completed: 0, expired: 0, abandoned: 0 } as Record<HistoryFilter, number>,
    );
  }, [items]);

  return (
    <AppShell>
      <View style={[styles.screen, screenGradient]}>
        <ScrollView
          contentContainerStyle={[
            styles.page,
            {
              maxWidth: pageMaxWidth,
              paddingHorizontal: horizontalPadding,
              paddingTop: 0,
              paddingBottom: insets.bottom + spacing['2xl'],
              gap: isCompact ? spacing.md : spacing.lg,
            },
          ]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <BackImageButton onPress={() => backOrReplace(router)} />
          </View>

          {error ? <ErrorCard message={error} onRetry={loadHistory} /> : null}

          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={palette.primary} />
              <Text style={styles.loadingText}>正在加载历史记录…</Text>
            </View>
          ) : null}

          <View style={[styles.filterRow, isCompact && styles.filterRowCompact]}>
            {FILTERS.map((filter) => {
              const selected = filter.key === selectedFilter;
              const count = filterCounts[filter.key];

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={filter.key}
                  onPress={() => setSelectedFilter(filter.key)}
                  style={({ pressed }) => [
                    styles.filterPill,
                    isCompact && styles.filterPillCompact,
                    selected && styles.filterPillActive,
                    pressed && styles.pressed,
                  ]}>
                  <View style={styles.filterContent}>
                    <Text style={[styles.filterText, selected && styles.filterTextActive]}>
                      {filter.label}
                    </Text>
                    <Text style={[styles.filterCount, selected && styles.filterTextActive]}>{count}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.list}>
            {visibleItems.map((item) => (
              <HistoryCard compact={isCompact} item={item} key={item.id} />
            ))}
          </View>
        </ScrollView>
      </View>
    </AppShell>
  );
}

function HistoryCard({ compact, item }: { compact: boolean; item: HistoryItem }) {
  const statusStyle = statusBadgeStyles[item.status];

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.cardRow}>
        <View style={styles.cardContent}>
          <Text numberOfLines={2} style={styles.cardTitle}>
            {item.title}
          </Text>
          <Text style={styles.cardSummary}>{item.summary}</Text>
          <View style={styles.dateSlot}>
            <Text style={styles.cardDate}>{toCardDate(item.date)}</Text>
          </View>
        </View>
        <View style={[styles.statusColumn, compact && styles.statusColumnCompact]}>
          <View style={[styles.statusPill, statusStyle.badge]}>
            <Text style={[styles.statusText, statusStyle.text]}>{STATUS_LABELS[item.status]}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const statusBadgeStyles: Record<
  HistoryItem['status'],
  { badge: ViewStyle; text: { color: string } }
> = {
  completed: {
    badge: { backgroundColor: palette.graySoft },
    text: { color: palette.success },
  },
  expired: {
    badge: { backgroundColor: '#EFEFF0' },
    text: { color: palette.muted },
  },
  abandoned: {
    badge: { backgroundColor: palette.coralSoft },
    text: { color: palette.coral },
  },
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    position: 'relative',
    backgroundColor: palette.canvas,
  },
  page: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    minHeight: components.topBarHeight - 2,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
  },
  loading: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  loadingText: {
    color: palette.muted,
    fontSize: typography.caption,
    lineHeight: 16,
    fontWeight: '400',
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterRowCompact: {
    flexWrap: 'wrap',
  },
  filterPill: {
    minHeight: components.buttonGhostHeight,
    flex: 1,
    minWidth: 0,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.94)',
  },
  filterPillCompact: {
    flexBasis: '47%',
  },
  filterPillActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
    ...shadows.primaryButton,
  },
  filterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  filterText: {
    color: palette.text,
    fontSize: typography.caption,
    lineHeight: 16,
    fontWeight: '900',
  },
  filterCount: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
  filterTextActive: {
    color: palette.white,
  },
  list: {
    gap: spacing.lg,
  },
  card: {
    minHeight: 136,
    borderRadius: radii['2xl'],
    backgroundColor: palette.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    ...shadows.card,
  },
  cardCompact: {
    paddingHorizontal: spacing.md,
  },
  cardRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardContent: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
  },
  cardTitle: {
    color: palette.ink,
    fontSize: typography.h3,
    lineHeight: 21,
    fontWeight: '900',
  },
  statusColumn: {
    width: STATUS_COLUMN_WIDTH,
    minHeight: components.chipHeight,
    alignItems: 'flex-end',
  },
  statusColumnCompact: {
    width: components.chipHeight + spacing['2xl'],
  },
  statusPill: {
    minHeight: components.chipHeight,
    minWidth: 58,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  statusText: {
    fontSize: typography.caption,
    lineHeight: 16,
    fontWeight: '400',
  },
  cardSummary: {
    marginTop: spacing.md,
    color: palette.muted,
    fontSize: typography.caption,
    lineHeight: 18,
    fontWeight: '800',
  },
  cardDate: {
    color: palette.placeholder,
    fontSize: typography.caption,
    lineHeight: 18,
    fontWeight: '400',
  },
  dateSlot: {
    marginTop: 'auto',
    paddingTop: spacing.md,
  },
  pressed: {
    opacity: 0.78,
  },
});
