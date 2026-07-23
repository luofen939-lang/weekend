import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { BackImageButton } from '@/components/back-image-button';
import { DesignPage } from '@/components/design-page';
import { ErrorCard } from '@/components/error-card';
import { useApp } from '@/contexts/app-context';
import { useLayoutInsets } from '@/hooks/use-layout-insets';
import { backOrReplace } from '@/lib/safe-return-to';
import { getMyDiaries } from '@/services/api';
import { palette, radii, shadows, spacing, typography } from '@/theme';
import type { MyDiaryItem } from '@/types';

const DEFAULT_MOOD = '未标注';
const HERO_MASCOT = require('../../assets/mascots/diary-cat.png');
const WATERFALL_GAP = 12;

type DiaryFilter = 'written' | 'public';
type DiaryCardItem = {
  record: MyDiaryItem;
  mood: string;
  moodText: string;
  statusLabel: string;
  tone: string;
  emoji: string;
  height: number;
};

function formatDate(value: string) {
  return value.replace(/-/g, '.');
}

function getDiaryMoods(record: MyDiaryItem) {
  const moodTags = record.moodTags ?? [];
  const mood = record.mood ?? '';
  const allMoods = [...moodTags, mood]
    .filter((item) => item && item.length > 0)
    .filter((item, index, list) => list.indexOf(item) === index);

  return allMoods.length > 0 ? allMoods : [DEFAULT_MOOD];
}

function getDiaryStatusLabel(record: MyDiaryItem) {
  if (record.reviewStatus === 'approved') return '已公开';
  if (record.reviewStatus === 'pending') return '审核中';
  return '未通过';
}

function isPublicDiary(record: MyDiaryItem) {
  return record.reviewStatus === 'approved' && (record.visibility === 'public' || record.visibility === 'public_requested');
}

function getDiaryTone(record: MyDiaryItem) {
  const mood = getDiaryMoods(record)[0];
  if (mood === '探索') return '#DDE6FF';
  if (mood === '治愈') return '#DAF4E9';
  if (mood === '社交') return '#FFE9D6';
  if (mood === '热闹') return '#FFE0E0';
  if (mood === '放松') return '#EEE7FF';
  return '#FFF0E8';
}

function getDiaryEmoji(record: MyDiaryItem) {
  const source = `${record.title} ${record.summary} ${record.feelingText} ${getDiaryMoods(record).join(' ')}`;
  if (source.includes('咖啡') || source.includes('文艺')) return '☕';
  if (source.includes('公园') || source.includes('森') || source.includes('放松')) return '🌿';
  if (source.includes('探索') || source.includes('City Walk')) return '🧭';
  if (source.includes('美食')) return '🍜';
  if (source.includes('雨')) return '☂';
  return '📝';
}

function getDiaryHeight(record: MyDiaryItem) {
  const base = [126, 138, 150, 162, 174][record.id % 5];
  const textBoost = Math.min(28, Math.floor(record.feelingText.length / 14) * 6);
  return base + textBoost;
}

function toDiaryCard(record: MyDiaryItem): DiaryCardItem {
  const moods = getDiaryMoods(record);
  return {
    record,
    mood: moods[0],
    moodText: moods.slice(0, 3).join(' · '),
    statusLabel: getDiaryStatusLabel(record),
    tone: getDiaryTone(record),
    emoji: getDiaryEmoji(record),
    height: getDiaryHeight(record),
  };
}

function getBalancedColumns(items: readonly DiaryCardItem[]) {
  const columns: DiaryCardItem[][] = [[], []];
  const heights = [0, 0];

  items.forEach((item) => {
    const targetColumn = heights[0] <= heights[1] ? 0 : 1;
    columns[targetColumn].push(item);
    heights[targetColumn] += item.height + 108 + WATERFALL_GAP;
  });

  return columns;
}

export default function MyDiaryScreen() {
  const router = useRouter();
  const insets = useLayoutInsets();
  const { user } = useApp();
  const [records, setRecords] = useState<MyDiaryItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<DiaryFilter>('written');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDiaries = useCallback(async () => {
    if (!user) {
      setRecords([]);
      setIsLoading(false);
      return;
    }

    setError(null);
    try {
      setRecords(await getMyDiaries(user.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '日记加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadDiaries();
    });
  }, [loadDiaries]);

  const publicRecords = useMemo(() => records.filter(isPublicDiary), [records]);
  const visibleRecords = activeFilter === 'public' ? publicRecords : records;
  const diaryCards = useMemo(() => visibleRecords.map(toDiaryCard), [visibleRecords]);
  const waterfallColumns = useMemo(() => getBalancedColumns(diaryCards), [diaryCards]);
  const isEmpty = records.length === 0;

  if (!user) {
    return (
      <DesignPage
        title="我的日记"
        step="12 / 16"
        badge="请先登录"
        heroTitle="把出门变成可回看的日记"
        heroBody="登录后，完成约定后提交的内容就会出现在这里。"
        heroTitleTone="soft"
        heroMascotSource={HERO_MASCOT}
        sections={[{ title: '提示', items: ['请先登录后查看我的日记。'], itemTone: 'soft', titleTone: 'muted' }]}
        secondary={{ label: '去登录', href: '/login' }}
      />
    );
  }

  if (isLoading) {
    return (
      <AppShell>
        <ScrollView
          contentContainerStyle={[
            styles.statePage,
            { paddingBottom: insets.bottom + spacing['2xl'] },
          ]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.loading}>
            <ActivityIndicator color={palette.primary} />
            <Text style={styles.stateText}>正在加载我的日记...</Text>
          </View>
        </ScrollView>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <ScrollView
          contentContainerStyle={[
            styles.statePage,
            { paddingBottom: insets.bottom + spacing['2xl'] },
          ]}
          showsVerticalScrollIndicator={false}>
          <ErrorCard message={error} onRetry={loadDiaries} />
        </ScrollView>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ScrollView
        contentContainerStyle={[
          styles.page,
          { paddingBottom: insets.bottom + spacing['3xl'] },
        ]}
        showsVerticalScrollIndicator={false}>
        <BackImageButton onPress={() => backOrReplace(router, '/profile')} style={styles.backButton} />

        <View style={styles.hero}>
          <View style={styles.heroOrbOne} />
          <View style={styles.heroOrbTwo} />
          <View style={styles.heroCopy}>
            <Text style={styles.heroBadge}>已写下的日记</Text>
            <Text style={styles.heroTitle}>把出门变成可回看的日记</Text>
            <Text style={styles.heroBody}>完成约定后提交的内容会在这里沉淀，慢慢变成有迹可循的成长记录。</Text>
          </View>
          <Image accessibilityIgnoresInvertColors resizeMode="contain" source={HERO_MASCOT} style={styles.heroMascot} />
        </View>

        <View style={styles.filterRow}>
          <DiaryFilterPill
            active={activeFilter === 'written'}
            count={records.length}
            label="已写下"
            onPress={() => setActiveFilter('written')}
          />
          <DiaryFilterPill
            active={activeFilter === 'public'}
            count={publicRecords.length}
            label="公开"
            onPress={() => setActiveFilter('public')}
          />
        </View>

        {isEmpty || diaryCards.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{isEmpty ? '还没有日记' : '还没有公开日记'}</Text>
            <Text style={styles.emptyBody}>
              {isEmpty ? '完成约定并提交后会出现在这里。' : '审核通过后，公开日记会展示在这里。'}
            </Text>
          </View>
        ) : (
          <View style={styles.waterfall}>
            {waterfallColumns.map((column, columnIndex) => (
              <View key={columnIndex} style={styles.waterfallColumn}>
                {column.map((item) => (
                  <DiaryWaterfallCard
                    item={item}
                    key={item.record.id}
                    onPress={() => router.push({ pathname: '/diary/[id]', params: { id: String(item.record.id) } })}
                  />
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </AppShell>
  );
}

function DiaryFilterPill({
  active,
  count,
  label,
  onPress,
}: {
  active: boolean;
  count: number;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterPill,
        active && styles.filterPillActive,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.filterPillValue, active && styles.filterPillValueActive]}>{count}篇</Text>
      <Text style={[styles.filterPillLabel, active && styles.filterPillLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function DiaryWaterfallCard({
  item,
  onPress,
}: {
  item: DiaryCardItem;
  onPress: () => void;
}) {
  const { record } = item;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.diaryCard, pressed && styles.pressed]}>
      <View style={[styles.diaryCover, { height: item.height, backgroundColor: item.tone }]}>
        <View style={styles.diaryCoverOrb} />
        <Text style={styles.diaryEmoji}>{item.emoji}</Text>
        <View style={styles.diaryTag}>
          <Text style={styles.diaryTagText}>{item.mood}</Text>
        </View>
      </View>
      <Text numberOfLines={2} style={styles.diaryTitle}>{record.title}</Text>
      <Text numberOfLines={2} style={styles.diarySummary}>{record.feelingText}</Text>
      <View style={styles.diaryMeta}>
        <View style={styles.diaryDot} />
        <Text numberOfLines={1} style={styles.diaryMetaText}>
          {formatDate(record.scheduledDate)} · {item.moodText}
        </Text>
      </View>
      <Text numberOfLines={1} style={styles.diaryStatus}>{item.statusLabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    minHeight: '100%',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  backButton: {
    marginLeft: -spacing.xs,
  },
  hero: {
    minHeight: 206,
    borderRadius: 34,
    backgroundColor: palette.white,
    overflow: 'hidden',
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 22,
    ...shadows.card,
  },
  heroOrbOne: {
    position: 'absolute',
    left: -42,
    bottom: -46,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#FFE9D6',
  },
  heroOrbTwo: {
    position: 'absolute',
    right: -24,
    top: -34,
    width: 158,
    height: 158,
    borderRadius: 79,
    backgroundColor: '#ECE8FF',
  },
  heroCopy: {
    flex: 1,
    maxWidth: '66%',
    zIndex: 1,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: palette.primarySoft,
    color: palette.primary,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  heroTitle: {
    marginTop: 12,
    color: palette.ink,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  heroBody: {
    marginTop: 12,
    color: palette.muted,
    fontSize: typography.body,
    lineHeight: 23,
    fontWeight: '800',
  },
  heroMascot: {
    width: 132,
    height: 132,
    zIndex: 1,
    marginLeft: -18,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
  },
  filterPill: {
    flex: 1,
    minHeight: 56,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadows.card,
  },
  filterPillActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  filterPillValue: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  filterPillLabel: {
    color: palette.muted,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  filterPillValueActive: {
    color: palette.white,
  },
  filterPillLabelActive: {
    color: palette.white,
  },
  waterfall: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: WATERFALL_GAP,
  },
  waterfallColumn: {
    flex: 1,
    gap: WATERFALL_GAP,
  },
  diaryCard: {
    borderRadius: 20,
    backgroundColor: palette.white,
    overflow: 'hidden',
    paddingBottom: 12,
    ...shadows.card,
  },
  diaryCover: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  diaryCoverOrb: {
    position: 'absolute',
    right: -26,
    top: 18,
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  diaryEmoji: {
    fontSize: 38,
  },
  diaryTag: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  diaryTagText: {
    color: palette.primary,
    fontSize: 10,
    fontWeight: '900',
  },
  diaryTitle: {
    paddingHorizontal: 12,
    paddingTop: 10,
    color: palette.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
  },
  diarySummary: {
    paddingHorizontal: 12,
    paddingTop: 4,
    color: palette.text,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  diaryMeta: {
    marginTop: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  diaryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.primary,
  },
  diaryMetaText: {
    flex: 1,
    color: palette.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  diaryStatus: {
    paddingHorizontal: 12,
    paddingTop: 6,
    color: palette.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  emptyCard: {
    borderRadius: 24,
    backgroundColor: palette.white,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    ...shadows.card,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  emptyBody: {
    color: palette.muted,
    fontSize: typography.caption,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.82,
  },
  statePage: {
    minHeight: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  loading: { alignItems: 'center', gap: spacing.sm },
  stateText: { color: palette.muted },
});
