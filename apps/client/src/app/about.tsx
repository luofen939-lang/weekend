import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { AppIcon } from '@/components/app-icon';
import { InnerPageHeader } from '@/components/inner-page-header';
import { backOrReplace } from '@/lib/safe-return-to';
import { ABOUT_INFO, BRAND_COPY } from '@/constants/exploration-content';
import { palette, radii, shadows, spacing, typography } from '@/theme';

export default function AboutScreen() {
  const router = useRouter();

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <InnerPageHeader title="关于懒得动" onBack={() => backOrReplace(router)} />

        <View style={styles.hero}>
          <Text style={styles.logo}>{BRAND_COPY.name}</Text>
          <Text style={styles.version}>{ABOUT_INFO.version}</Text>
          <Text style={styles.slogan}>{BRAND_COPY.slogan}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{ABOUT_INFO.tagline}</Text>
          <Text style={styles.body}>{ABOUT_INFO.description}</Text>
          <Text style={styles.features}>{BRAND_COPY.features}</Text>
        </View>

        <View style={styles.menuPanel}>
          {ABOUT_INFO.links.map((link, index) => (
            <Pressable
              accessibilityRole="button"
              key={link.id}
              style={[styles.menuRow, index < ABOUT_INFO.links.length - 1 && styles.menuRowBorder]}>
              <Text style={styles.menuLabel}>{link.label}</Text>
              <AppIcon name="arrow-right" size={16} color={palette.placeholder} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['2xl'] },
  hero: {
    backgroundColor: palette.primary,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  logo: { color: palette.white, fontSize: 32, fontWeight: '900' },
  version: { color: 'rgba(255,255,255,0.8)', fontSize: typography.caption, marginTop: 4 },
  slogan: {
    color: palette.white,
    fontSize: typography.body,
    fontWeight: '700',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  panel: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  panelTitle: { color: palette.primary, fontSize: typography.body, fontWeight: '900' },
  body: { color: palette.text, fontSize: typography.body, lineHeight: 22, marginTop: spacing.sm },
  features: { color: palette.muted, fontSize: typography.caption, marginTop: spacing.md },
  menuPanel: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
    ...shadows.card,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  menuRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  menuLabel: { flex: 1, color: palette.ink, fontSize: typography.body, fontWeight: '700' },
});
