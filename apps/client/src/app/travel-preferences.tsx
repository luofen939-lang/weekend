import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { InnerPageHeader } from '@/components/inner-page-header';
import { PrimaryButton } from '@/components/primary-button';
import { useLayoutInsets } from '@/hooks/use-layout-insets';
import { backOrReplace } from '@/lib/safe-return-to';
import { getTravelTags, saveTravelPreferences } from '@/services/travel-api';
import { palette, radii, spacing, typography } from '@/theme';

const TRIP_TYPES = ['独自', '情侣游', '亲子游', '朋友聚会'];

export default function TravelPreferencesScreen() {
  const router = useRouter();
  const insets = useLayoutInsets();
  const [tags, setTags] = useState<{ id: number; name: string }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [tripTypes, setTripTypes] = useState<string[]>(['情侣游']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getTravelTags()
      .then((data) => setTags(data))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (name: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(name) ? list.filter((x) => x !== name) : [...list, name]);
  };

  async function handleContinue() {
    setSaving(true);
    try {
      await saveTravelPreferences({ preferenceTags: selected, tripTypes });
    } catch {
      // 未登录也可继续，仅本地推荐
    } finally {
      setSaving(false);
    }
    router.push({
      pathname: '/ai-recommend',
      params: { preferences: selected.join(','), tripType: tripTypes[0] ?? '周末轻旅' },
    });
  }

  return (
    <AppShell>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <InnerPageHeader title="旅行偏好" onBack={() => backOrReplace(router)} />
        <Text style={styles.desc}>选择你的兴趣，AI 将据此推荐景点和行程</Text>

        {loading ? (
          <ActivityIndicator color={palette.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            <Text style={styles.section}>兴趣标签</Text>
            <View style={styles.wrap}>
              {tags.map((tag) => (
                <Pressable
                  key={tag.id}
                  onPress={() => toggle(tag.name, selected, setSelected)}
                  style={[styles.chip, selected.includes(tag.name) && styles.chipActive]}>
                  <Text style={[styles.chipText, selected.includes(tag.name) && styles.chipTextActive]}>
                    {tag.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.section}>出行类型</Text>
            <View style={styles.wrap}>
              {TRIP_TYPES.map((type, index) => (
                <Pressable
                  key={`${type}-${index}`}
                  onPress={() => toggle(type, tripTypes, setTripTypes)}
                  style={[styles.chip, tripTypes.includes(type) && styles.chipActive]}>
                  <Text style={[styles.chipText, tripTypes.includes(type) && styles.chipTextActive]}>
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton
          label={saving ? '保存中…' : '开始 AI 推荐'}
          onPress={handleContinue}
          disabled={selected.length === 0 || saving}
        />
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  desc: { paddingHorizontal: spacing.lg, color: palette.muted, fontSize: typography.body, marginBottom: spacing.lg },
  section: { paddingHorizontal: spacing.lg, fontWeight: '700', fontSize: typography.body, color: palette.ink, marginBottom: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.contour,
  },
  chipActive: { backgroundColor: palette.primarySoft, borderColor: palette.primary },
  chipText: { color: palette.text, fontSize: typography.caption },
  chipTextActive: { color: palette.primary, fontWeight: '700' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: palette.canvas,
  },
});
