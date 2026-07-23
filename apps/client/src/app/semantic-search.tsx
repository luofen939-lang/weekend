import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppShell } from '@/components/app-shell';
import { AppIcon } from '@/components/app-icon';
import { InnerPageHeader } from '@/components/inner-page-header';
import { useLayoutInsets } from '@/hooks/use-layout-insets';
import { backOrReplace } from '@/lib/safe-return-to';
import { semanticSearch } from '@/services/travel-api';
import { palette, radii, shadows, spacing, typography } from '@/theme';
import type { SemanticSearchHit } from '@/types/travel';

export default function SemanticSearchScreen() {
  const router = useRouter();
  const insets = useLayoutInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SemanticSearchHit[]>([]);
  const [mode, setMode] = useState<string>('keyword');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async (text?: string) => {
    const q = (text ?? query).trim();
    if (q.length < 2) return;

    setLoading(true);
    setSearched(true);
    try {
      const data = await semanticSearch(q, 'all');
      setResults(data.results);
      setMode(data.mode);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <AppShell>
      <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
        <InnerPageHeader title="智能搜索" onBack={() => backOrReplace(router)} />

        <View style={styles.searchWrap}>
          <View style={styles.searchBox}>
            <AppIcon name="search" size={16} color={palette.placeholder} />
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder="试试：适合情侣的海边旅行"
              placeholderTextColor={palette.placeholder}
              returnKeyType="search"
              onSubmitEditing={() => void handleSearch()}
            />
          </View>
          <Pressable style={styles.searchBtn} onPress={() => void handleSearch()}>
            <Text style={styles.searchBtnText}>搜索</Text>
          </Pressable>
        </View>

        <Text style={styles.modeHint}>
          {mode === 'semantic' ? '语义理解模式' : '关键词匹配模式（配置 AI 后自动升级）'}
        </Text>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={palette.primary} />
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => `${item.type}-${item.id}`}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              searched ? (
                <Text style={styles.empty}>没有找到匹配结果</Text>
              ) : (
                <Text style={styles.empty}>输入描述开始搜索</Text>
              )
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.card}
                onPress={() => {
                  if (item.type === 'destination') {
                    router.push({ pathname: '/ai-recommend', params: { preferences: item.tags.join(',') } });
                  }
                }}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.badge}>{item.type === 'destination' ? '目的地' : '景点'}</Text>
                </View>
                <Text style={styles.summary} numberOfLines={2}>{item.summary}</Text>
                {item.score > 0 ? (
                  <Text style={styles.score}>匹配度 {(item.score * 100).toFixed(0)}%</Text>
                ) : null}
              </Pressable>
            )}
          />
        )}
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.canvas },
  searchWrap: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 44,
    ...shadows.card,
  },
  input: { flex: 1, fontSize: typography.body, color: palette.text },
  searchBtn: {
    backgroundColor: palette.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    height: 44,
    justifyContent: 'center',
  },
  searchBtnText: { color: palette.white, fontWeight: '700' },
  modeHint: { fontSize: typography.caption, color: palette.muted, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.lg, gap: spacing.md },
  empty: { textAlign: 'center', color: palette.muted, padding: spacing.xl },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { flex: 1, fontSize: typography.h3, fontWeight: '700', color: palette.ink },
  badge: {
    fontSize: 10,
    color: palette.primary,
    backgroundColor: palette.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  summary: { color: palette.muted, marginTop: spacing.sm, fontSize: typography.body },
  score: { color: palette.primary, fontSize: typography.caption, marginTop: spacing.sm },
});
