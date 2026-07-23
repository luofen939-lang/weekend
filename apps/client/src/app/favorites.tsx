import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { AppIcon } from '@/components/app-icon';
import { InnerPageHeader } from '@/components/inner-page-header';
import { PrimaryButton } from '@/components/primary-button';
import { FAVORITE_ITEMS, FAVORITE_TABS } from '@/constants/exploration-content';
import { backOrReplace } from '@/lib/safe-return-to';
import { palette, radii, shadows, spacing, typography } from '@/theme';

export default function FavoritesScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof FAVORITE_TABS)[number]>('全部');

  const items = useMemo(() => {
    if (tab === '全部') return FAVORITE_ITEMS;
    if (tab === '路线') return FAVORITE_ITEMS.filter((item) => item.type === 'route');
    return FAVORITE_ITEMS.filter((item) => item.type === 'dest');
  }, [tab]);

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <InnerPageHeader title="我的收藏" onBack={() => backOrReplace(router)} />
        <Text style={styles.subtitle}>共 {FAVORITE_ITEMS.length} 条，路线与目的地都在这里。</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}>
          {FAVORITE_TABS.map((item, index) => {
            const active = item === tab;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={`${item}-${index}`}
                onPress={() => setTab(item)}
                style={[styles.tabChip, active && styles.tabChipActive]}>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{item}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {items.length === 0 ? (
          <View style={styles.empty}>
            <AppIcon name="star" size={40} color={palette.sunset} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>还没有收藏</Text>
            <Text style={styles.emptyBody}>在首页或详情页收藏路线，会出现在这里。</Text>
            <PrimaryButton label="去发现" onPress={() => router.replace('/')} />
          </View>
        ) : (
          <View style={styles.list}>
            {items.map((item) => (
              <Pressable
                accessibilityRole="button"
                key={item.id}
                onPress={() => router.push('/preferences')}
                style={styles.card}>
                <View style={[styles.thumb, { backgroundColor: item.tone.bg }]}>
                  <Text style={[styles.badge, { color: item.tone.text }]}>{item.badge}</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.cardMeta}>{item.meta}</Text>
                  <Text style={styles.cardLocation}>{item.location}</Text>
                  <View style={styles.priceRow}>
                    {item.price === '免费' ? (
                      <Text style={styles.priceFree}>免费</Text>
                    ) : (
                      <>
                        <Text style={styles.price}>¥{item.price}</Text>
                        {item.priceLabel ? (
                          <Text style={styles.priceLabel}>{item.priceLabel}</Text>
                        ) : null}
                      </>
                    )}
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['2xl'] },
  subtitle: { color: palette.muted, fontSize: typography.body, lineHeight: 20 },
  tabs: { gap: spacing.sm, paddingBottom: spacing.sm },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.border,
  },
  tabChipActive: { backgroundColor: palette.primarySoft, borderColor: palette.primary },
  tabText: { color: palette.text, fontSize: typography.caption, fontWeight: '700' },
  tabTextActive: { color: palette.primary, fontWeight: '800' },
  list: { gap: spacing.md },
  card: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
    ...shadows.card,
  },
  thumb: {
    width: 110,
    minHeight: 110,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: spacing.sm,
  },
  badge: {
    backgroundColor: palette.surface,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs,
    overflow: 'hidden',
  },
  cardBody: { flex: 1, padding: spacing.md },
  cardTitle: { color: palette.ink, fontSize: typography.body, fontWeight: '900' },
  cardMeta: { color: palette.muted, fontSize: typography.caption, marginTop: 4 },
  cardLocation: { color: palette.placeholder, fontSize: typography.caption, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: spacing.sm },
  price: { color: palette.price, fontSize: typography.price, fontWeight: '900' },
  priceLabel: { color: palette.muted, fontSize: typography.caption },
  priceFree: { color: palette.seafoam, fontSize: typography.body, fontWeight: '800' },
  empty: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.card,
  },
  emptyIcon: { marginBottom: spacing.md },
  emptyTitle: { color: palette.ink, fontSize: typography.h3, fontWeight: '900' },
  emptyBody: {
    color: palette.muted,
    fontSize: typography.body,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
});
