import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ErrorCard } from '@/components/error-card';
import { InnerPageHeader } from '@/components/inner-page-header';
import { useApp } from '@/contexts/app-context';
import { useLayoutInsets } from '@/hooks/use-layout-insets';
import { backOrReplace } from '@/lib/safe-return-to';
import { getAiRecommendations } from '@/services/travel-api';
import { palette, radii, shadows, spacing, typography } from '@/theme';
import type { RecommendItem } from '@/types/travel';

const STRATEGY_LABEL: Record<string, string> = {
  semantic: '语义',
  tag: '标签',
  collaborative: '相似用户',
  behavior: '行为',
};

export default function AiRecommendScreen() {
  const router = useRouter();
  const insets = useLayoutInsets();
  const { cities, selectedCityId } = useApp();
  const params = useLocalSearchParams<{ preferences?: string; tripType?: string; budget?: string }>();

  const selectedCity = cities.find((c) => c.id === selectedCityId);
  const preferences = useMemo(
    () => params.preferences?.split(',').filter(Boolean) ?? ['自然风光', '探索'],
    [params.preferences],
  );
  const tripType = params.tripType ?? '周末轻旅';
  const budget = params.budget ? Number(params.budget) : 500;

  const [items, setItems] = useState<RecommendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);

      void getAiRecommendations({
        destination: selectedCity?.name,
        preferences,
        tripType,
        budget,
        days: 2,
        travelers: 2,
      })
        .then((data) => {
          if (!cancelled) setItems(data.recommendations);
        })
        .catch((reason: unknown) => {
          if (!cancelled) {
            setError(reason instanceof Error ? reason.message : '推荐加载失败');
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [budget, preferences, selectedCity?.name, tripType]);

  function retry() {
    setLoading(true);
    setError(null);
    void getAiRecommendations({
      destination: selectedCity?.name,
      preferences,
      tripType,
      budget,
      days: 2,
      travelers: 2,
    })
      .then((data) => setItems(data.recommendations))
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : '推荐加载失败'),
      )
      .finally(() => setLoading(false));
  }

  return (
    <AppShell>
      <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <InnerPageHeader title="AI 为你推荐" onBack={() => backOrReplace(router)} variant="light" />
          <Text style={styles.sub}>
            {selectedCity?.name ?? '全国'} · {preferences.join('、')}
          </Text>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={palette.primary} size="large" />
            <Text style={styles.loadingText}>AI 正在挑选景点…</Text>
          </View>
        ) : error ? (
          <View style={styles.pad}>
            <ErrorCard message={error} onRetry={retry} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.attractionId)}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.lg }]}
            ListEmptyComponent={<Text style={styles.empty}>暂无推荐，试试调整偏好</Text>}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.score}>{(item.score * 100).toFixed(0)}分</Text>
                </View>
                <Text style={styles.meta}>⭐ {item.rating.toFixed(1)} · ¥{item.priceRange}</Text>
                <View style={styles.tags}>
                  {item.matchTags.map((tag, index) => (
                    <Text key={`${tag}-${index}`} style={styles.tag}>{tag}</Text>
                  ))}
                </View>
                <View style={styles.reasonBox}>
                  <Text style={styles.reason}>💡 {item.aiReason}</Text>
                  <View style={styles.badges}>
                    {item.recStrategy.map((s, index) => (
                      <Text key={`${s}-${index}`} style={styles.badge}>
                        {STRATEGY_LABEL[s] ?? s}
                      </Text>
                    ))}
                  </View>
                </View>
              </View>
            )}
          />
        )}

        <Pressable style={styles.tripBtn} onPress={() => router.push('/ai-trip')}>
          <Text style={styles.tripBtnText}>生成完整 AI 行程 →</Text>
        </Pressable>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.canvas },
  header: { backgroundColor: palette.primary, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  sub: { color: 'rgba(255,255,255,0.85)', fontSize: typography.caption, marginTop: -spacing.sm },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { color: palette.muted, fontSize: typography.body },
  pad: { padding: spacing.lg },
  list: { padding: spacing.lg, gap: spacing.md },
  empty: { textAlign: 'center', color: palette.muted, padding: spacing.xl },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { flex: 1, fontSize: typography.h3, fontWeight: '700', color: palette.ink },
  score: { color: palette.primary, fontWeight: '800', fontSize: typography.body },
  meta: { color: palette.muted, fontSize: typography.caption, marginTop: spacing.xs },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  tag: {
    fontSize: typography.caption,
    color: palette.primary,
    backgroundColor: palette.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  reasonBox: {
    marginTop: spacing.md,
    backgroundColor: palette.primarySoft,
    borderRadius: radii.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: palette.primary,
  },
  reason: { fontSize: typography.body, color: palette.text, lineHeight: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  badge: {
    fontSize: 10,
    color: palette.primary,
    backgroundColor: palette.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tripBtn: {
    margin: spacing.lg,
    backgroundColor: palette.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  tripBtnText: { color: palette.white, fontWeight: '700', fontSize: typography.body },
});
