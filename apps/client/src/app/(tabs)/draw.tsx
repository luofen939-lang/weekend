import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { AppShell } from '@/components/app-shell';
import { ErrorCard } from '@/components/error-card';
import { useApp } from '@/contexts/app-context';
import { formatBudget, formatDistanceMetric, formatDuration } from '@/formatters';
import { useLayoutInsets } from '@/hooks/use-layout-insets';
import { palette, radii, shadows, spacing, typography } from '@/theme';

const drawTheme = {
  ink: palette.ink,
  text: palette.text,
  muted: palette.muted,
  paper: palette.canvas,
  surface: palette.surface,
  primary: palette.primary,
  primaryDark: palette.primaryDark,
  primarySoft: palette.primarySoft,
  yellow: palette.yellow,
  mint: palette.seafoamSoft,
  coral: palette.coral,
  line: palette.border,
};

/** Tab：抽盲盒入口（对齐高保真稿底部「抽盲盒」） */
export default function DrawTabScreen() {
  const router = useRouter();
  const { currentDraw, error, isBooting, reroll } = useApp();
  const { tabBarHeight } = useLayoutInsets();
  const [isRerolling, setIsRerolling] = useState(false);

  async function handleReroll() {
    if (!currentDraw || currentDraw.attemptsRemaining <= 0) return;
    setIsRerolling(true);
    try {
      await reroll();
    } catch (reason) {
      console.error('重抽失败', reason);
    } finally {
      setIsRerolling(false);
    }
  }

  if (isBooting) {
    return (
      <AppShell>
        <View style={[styles.centered, { paddingBottom: tabBarHeight + spacing.lg }]}>
          <ActivityIndicator color={drawTheme.primary} size="large" />
        </View>
      </AppShell>
    );
  }

  const moodLabel = currentDraw
    ? ((currentDraw.activity.moodTags ?? []).length > 0
      ? (currentDraw.activity.moodTags ?? []).slice(0, 3).join(' · ')
      : currentDraw.activity.mood)
    : '';
  const recommendation = currentDraw?.recommendation;

  return (
    <AppShell>
      {currentDraw ? (
        <View style={styles.resultRoot}>
          <ScrollView
            contentContainerStyle={[styles.resultPage, { paddingBottom: tabBarHeight + 116 }]}
            showsVerticalScrollIndicator={false}>
            <View style={styles.resultTopbar}>
              <Pressable
                accessibilityRole="button"
                hitSlop={12}
                onPress={() => router.push('/preferences')}>
                <Text style={styles.backLink}>← 重新选偏好</Text>
              </Pressable>
              <View style={styles.favoriteBtn}>
                <Text style={styles.favoriteText}>♡</Text>
              </View>
            </View>

            <View style={styles.resultHeading}>
              <Text style={styles.eyebrow}>✦ 你的盲盒打开了</Text>
              <Text style={styles.resultTitle}>今天，就去这里。</Text>
            </View>

            {error ? <ErrorCard message={error} /> : null}

            <View style={styles.resultCard}>
              <View style={[styles.resultImage, { backgroundColor: currentDraw.activity.accentColor }]}>
                <View style={styles.resultGlowOne} />
                <View style={styles.resultGlowTwo} />
                <Text style={styles.resultBadge}>
                  {recommendation?.display.badge ?? `${currentDraw.activity.category} · ${moodLabel}`}
                </Text>
                <View style={styles.resultPlace}>
                  <Text style={styles.resultPlaceTitle}>{currentDraw.activity.title}</Text>
                  <Text style={styles.resultPlaceSub}>
                    {currentDraw.activity.district} · {currentDraw.activity.summary}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.meta}>
                  <Text style={styles.metaLabel}>预计时间</Text>
                  <Text style={styles.metaValue}>{formatDuration(currentDraw.activity.durationMinutes)}</Text>
                </View>
                <View style={styles.meta}>
                  <Text style={styles.metaLabel}>人均预算</Text>
                  <Text style={styles.metaValue}>{formatBudget(currentDraw.activity.budgetYuan)}</Text>
                </View>
                <View style={styles.meta}>
                  <Text style={styles.metaLabel}>出行距离</Text>
                  <Text style={styles.metaValue}>
                    {formatDistanceMetric(currentDraw.activity.distanceKm, recommendation?.constraintSummary.distance)}
                  </Text>
                </View>
              </View>

              {recommendation ? (
                <View style={styles.resultReason}>
                  <Text style={styles.resultReasonLabel}>为什么是它</Text>
                  <Text style={styles.resultReasonText}>{recommendation.display.cardPage}</Text>
                </View>
              ) : null}

              <View style={styles.chance}>
                <Text style={styles.chanceText}>本次机会</Text>
                <View style={styles.chanceDots}>
                  {[0, 1, 2].map((item) => (
                    <View
                      key={item}
                      style={[styles.chanceDot, item < currentDraw.attemptsUsed && styles.chanceDotUsed]}
                    />
                  ))}
                </View>
                <Text style={styles.chanceText}>还可重抽 {currentDraw.attemptsRemaining} 次</Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.resultActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/activity/[id]',
                  params: {
                    id: String(currentDraw.activity.id),
                    source: 'ai',
                    drawSessionId: currentDraw.drawSessionId,
                  },
                })
              }
              style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}>
              <Text style={styles.primaryActionText}>就是这个了 →</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isRerolling || currentDraw.attemptsRemaining <= 0}
              onPress={() => void handleReroll()}
              style={({ pressed }) => [
                styles.secondaryAction,
                (isRerolling || currentDraw.attemptsRemaining <= 0) && styles.disabledAction,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.secondaryActionText}>
                {currentDraw.attemptsRemaining > 0 ? '↻ 再抽一次' : '本次机会已用完'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.page, { paddingBottom: tabBarHeight + spacing.lg }]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.topbar}>
            <View style={styles.logo}>
              <View style={styles.logoMark}>
                <Text style={styles.logoMarkText}>懒</Text>
              </View>
              <Text style={styles.logoText}>懒得动</Text>
            </View>
          </View>

          <View style={styles.homeContent}>
            <Text style={styles.eyebrow}>✦ 本地周末玩乐盲盒</Text>
            <Text style={styles.heroTitle}>
              今天去哪玩？{'\n'}
              <Text style={styles.heroTitleAccent}>别纠结，让我来。</Text>
            </Text>
            <Text style={styles.heroCopy}>给我 30 秒说说偏好，我替你做一个值得出门的决定。</Text>

            <View style={styles.locationCard}>
              <View style={styles.locationMain}>
                <View style={styles.locationPin}>
                  <AppIcon name="location" size={18} color={drawTheme.primary} />
                </View>
                <View>
                  <Text style={styles.tinyLabel}>当前城市</Text>
                  <Text style={styles.strongLabel}>上海 · 静安区</Text>
                </View>
              </View>
              <Text style={styles.changeText}>切换</Text>
            </View>

            <View style={styles.moodScene}>
              <View style={styles.sceneCloud} />
              <View style={styles.hill} />
              <View style={[styles.hill, styles.hillTwo]} />
              <View style={styles.person} />
              <Text style={styles.sceneTag}>今天，去看点没看过的 ✨</Text>
            </View>

            <View style={styles.trustRow}>
              <Text style={styles.trustItem}>3 次结果机会</Text>
              <Text style={styles.trustItem}>无需做攻略</Text>
              <Text style={styles.trustItem}>随时可退出</Text>
            </View>

            {error ? <ErrorCard message={error} /> : null}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/preferences')}
            style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}>
            <Text style={styles.primaryActionText}>帮我决定去哪玩 →</Text>
          </Pressable>
        </ScrollView>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: drawTheme.paper,
  },
  page: {
    flexGrow: 1,
    backgroundColor: drawTheme.paper,
    paddingHorizontal: 20,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  topbar: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoMark: {
    width: 31,
    height: 31,
    borderRadius: 11,
    backgroundColor: drawTheme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-5deg' }],
  },
  logoMarkText: { color: palette.white, fontSize: 17, fontWeight: '900' },
  logoText: { color: drawTheme.ink, fontSize: 17, fontWeight: '900' },
  homeContent: { gap: spacing.md },
  eyebrow: {
    alignSelf: 'flex-start',
    backgroundColor: drawTheme.yellow,
    borderRadius: radii.pill,
    color: drawTheme.ink,
    fontSize: typography.caption,
    fontWeight: '900',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  heroTitle: {
    color: drawTheme.ink,
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 44,
  },
  heroTitleAccent: { color: drawTheme.primary },
  heroCopy: { color: drawTheme.muted, fontSize: 15, lineHeight: 25 },
  locationCard: {
    marginTop: spacing.sm,
    backgroundColor: drawTheme.surface,
    borderRadius: 22,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.card,
  },
  locationMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  locationPin: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: drawTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tinyLabel: { color: drawTheme.muted, fontSize: 11, fontWeight: '700' },
  strongLabel: { color: drawTheme.ink, fontSize: typography.body, fontWeight: '900', marginTop: 3 },
  changeText: { color: drawTheme.primary, fontSize: typography.caption, fontWeight: '900' },
  moodScene: {
    height: 238,
    borderRadius: 34,
    backgroundColor: drawTheme.mint,
    overflow: 'hidden',
    marginTop: spacing.sm,
    position: 'relative',
  },
  sceneCloud: {
    position: 'absolute',
    top: 42,
    left: 36,
    width: 112,
    height: 46,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  hill: {
    position: 'absolute',
    bottom: -34,
    left: -32,
    width: 260,
    height: 128,
    borderRadius: 90,
    backgroundColor: '#8EDDB8',
  },
  hillTwo: {
    left: 142,
    bottom: -44,
    backgroundColor: '#6FCEAA',
  },
  person: {
    position: 'absolute',
    right: 58,
    bottom: 78,
    width: 34,
    height: 58,
    borderRadius: 18,
    backgroundColor: drawTheme.primary,
    borderWidth: 6,
    borderColor: drawTheme.paper,
  },
  sceneTag: {
    position: 'absolute',
    left: 22,
    bottom: 22,
    color: drawTheme.ink,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontWeight: '900',
    overflow: 'hidden',
  },
  trustRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  trustItem: {
    flexGrow: 1,
    textAlign: 'center',
    color: drawTheme.text,
    backgroundColor: drawTheme.surface,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    fontSize: 12,
    fontWeight: '800',
  },
  resultRoot: { flex: 1, backgroundColor: drawTheme.primarySoft },
  resultPage: {
    paddingHorizontal: 20,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  resultTopbar: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backLink: { color: drawTheme.primaryDark, fontSize: typography.body, fontWeight: '900' },
  favoriteBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: drawTheme.line,
    backgroundColor: 'rgba(255,255,255,0.76)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteText: { color: drawTheme.ink, fontSize: 20, fontWeight: '800' },
  resultHeading: { gap: spacing.xs },
  resultTitle: {
    color: drawTheme.ink,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  resultCard: {
    backgroundColor: drawTheme.surface,
    borderRadius: 30,
    overflow: 'hidden',
    ...shadows.elevated,
  },
  resultImage: {
    height: 360,
    padding: spacing.lg,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  resultGlowOne: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.28)',
    right: -44,
    top: 36,
  },
  resultGlowTwo: {
    position: 'absolute',
    width: 220,
    height: 118,
    borderRadius: 70,
    backgroundColor: 'rgba(0,0,0,0.10)',
    left: -34,
    bottom: -18,
  },
  resultBadge: {
    alignSelf: 'flex-start',
    color: drawTheme.ink,
    backgroundColor: drawTheme.yellow,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.caption,
    fontWeight: '900',
    overflow: 'hidden',
  },
  resultPlace: { gap: spacing.xs },
  resultPlaceTitle: { color: palette.white, fontSize: 28, lineHeight: 32, fontWeight: '900' },
  resultPlaceSub: { color: 'rgba(255,255,255,0.86)', fontSize: typography.body, lineHeight: 22 },
  metaRow: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  meta: { flex: 1 },
  metaLabel: { color: drawTheme.muted, fontSize: 11, fontWeight: '700' },
  metaValue: { color: drawTheme.ink, fontSize: typography.body, fontWeight: '900', marginTop: 4 },
  resultReason: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: 18,
    backgroundColor: 'rgba(121,103,247,0.10)',
    padding: spacing.md,
  },
  resultReasonLabel: { color: drawTheme.primary, fontSize: 11, fontWeight: '900' },
  resultReasonText: { marginTop: 5, color: drawTheme.text, fontSize: typography.caption, lineHeight: 18, fontWeight: '800' },
  chance: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: drawTheme.line,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  chanceText: { color: drawTheme.muted, fontSize: typography.caption, fontWeight: '800' },
  chanceDots: { flexDirection: 'row', gap: 6 },
  chanceDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#D8D0F7' },
  chanceDotUsed: { backgroundColor: drawTheme.primary },
  resultActions: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 18,
    gap: spacing.sm,
  },
  primaryAction: {
    minHeight: 54,
    borderRadius: 19,
    backgroundColor: drawTheme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.primaryButton,
  },
  primaryActionText: { color: palette.white, fontSize: typography.body, fontWeight: '900' },
  secondaryAction: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: { color: drawTheme.primaryDark, fontSize: typography.body, fontWeight: '900' },
  disabledAction: { opacity: 0.45 },
  pressed: { opacity: 0.82 },
});
