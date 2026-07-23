import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ErrorCard } from '@/components/error-card';
import { InnerPageHeader } from '@/components/inner-page-header';
import { useApp } from '@/contexts/app-context';
import { useLayoutInsets } from '@/hooks/use-layout-insets';
import { backOrReplace } from '@/lib/safe-return-to';
import { generateTripAsync, generateTripStream } from '@/services/travel-api';
import { palette, radii, shadows, spacing, typography } from '@/theme';

const TAGS = ['自然风光', '历史文化', '美食购物', '亲子游', '情侣游', '探索'];

type ParsedTripDay = {
  day: number;
  theme: string;
  items: { name: string; type: string }[];
};

export default function AiTripScreen() {
  const router = useRouter();
  const insets = useLayoutInsets();
  const { cities, selectedCityId } = useApp();
  const selectedCity = cities.find((c) => c.id === selectedCityId);

  const [destination, setDestination] = useState(selectedCity?.name ?? '上海');
  const [days, setDays] = useState('2');
  const [budget, setBudget] = useState('800');
  const [travelers, setTravelers] = useState('2');
  const [preferences, setPreferences] = useState<string[]>(['探索', '治愈']);
  const [streaming, setStreaming] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTag = (tag: string) => {
    setPreferences((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStreaming('');
    setResult(null);

    const params = {
      destination,
      days: Number(days),
      budget: Number(budget),
      travelers: Number(travelers),
      preferences,
      tripType: '周末轻旅',
    };

    try {
      if (typeof ReadableStream !== 'undefined') {
        await generateTripStream(
          params,
          (delta) => setStreaming((prev) => prev + delta),
          (full) => setResult(full),
        );
      } else {
        const { taskId } = await generateTripAsync(params);
        setResult(`任务已提交：${taskId}\n（当前环境使用轮询模式，请在任务页查看结果）`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setLoading(false);
    }
  }, [destination, days, budget, travelers, preferences]);

  let parsedTrip: { tripTitle?: string; summary?: string; days?: ParsedTripDay[] } | null = null;
  if (result) {
    try {
      parsedTrip = JSON.parse(result.replace(/```json|```/g, '').trim());
    } catch {
      parsedTrip = null;
    }
  }

  return (
    <AppShell>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing['2xl'] }}>
        <InnerPageHeader title="AI 智能行程" onBack={() => backOrReplace(router)} />

        <View style={styles.form}>
          <Text style={styles.label}>目的地</Text>
          <TextInput style={styles.input} value={destination} onChangeText={setDestination} />

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>天数</Text>
              <TextInput style={styles.input} value={days} onChangeText={setDays} keyboardType="number-pad" />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>预算</Text>
              <TextInput style={styles.input} value={budget} onChangeText={setBudget} keyboardType="number-pad" />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>人数</Text>
              <TextInput style={styles.input} value={travelers} onChangeText={setTravelers} keyboardType="number-pad" />
            </View>
          </View>

          <Text style={styles.label}>偏好</Text>
          <View style={styles.tags}>
              {TAGS.map((tag, index) => (
                <Pressable
                  key={`${tag}-${index}`}
                  onPress={() => toggleTag(tag)}
                  style={[styles.tag, preferences.includes(tag) && styles.tagActive]}>
                <Text style={[styles.tagText, preferences.includes(tag) && styles.tagTextActive]}>{tag}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.btn} onPress={handleGenerate} disabled={loading}>
            {loading ? <ActivityIndicator color={palette.white} /> : <Text style={styles.btnText}>生成行程</Text>}
          </Pressable>
        </View>

        {error ? <View style={styles.pad}><ErrorCard message={error} onRetry={handleGenerate} /></View> : null}

        {loading && streaming ? (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>AI 正在规划…</Text>
            <Text style={styles.streamText}>{streaming}</Text>
          </View>
        ) : null}

        {parsedTrip ? (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>{parsedTrip.tripTitle ?? '你的行程'}</Text>
            {parsedTrip.summary ? <Text style={styles.summary}>{parsedTrip.summary}</Text> : null}
            {parsedTrip.days?.map((day) => (
              <View key={day.day} style={styles.dayBlock}>
                <Text style={styles.dayTitle}>Day {day.day} · {day.theme}</Text>
                {day.items.map((item, i) => (
                  <Text key={i} style={styles.item}>· [{item.type}] {item.name}</Text>
                ))}
              </View>
            ))}
          </View>
        ) : result && !loading ? (
          <View style={styles.resultBox}>
            <Text style={styles.streamText}>{result}</Text>
          </View>
        ) : null}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.canvas },
  form: { padding: spacing.lg, gap: spacing.sm },
  label: { fontSize: typography.caption, color: palette.muted, marginBottom: 4 },
  input: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.body,
    borderWidth: 1,
    borderColor: palette.contour,
    ...shadows.card,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  col: { flex: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.sm },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.contour,
  },
  tagActive: { backgroundColor: palette.primarySoft, borderColor: palette.primary },
  tagText: { fontSize: typography.caption, color: palette.text },
  tagTextActive: { color: palette.primary, fontWeight: '700' },
  btn: {
    backgroundColor: palette.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  btnText: { color: palette.white, fontWeight: '700', fontSize: typography.body },
  pad: { paddingHorizontal: spacing.lg },
  resultBox: {
    margin: spacing.lg,
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  resultTitle: { fontSize: typography.h3, fontWeight: '800', color: palette.ink },
  summary: { color: palette.muted, marginTop: spacing.sm, lineHeight: 22 },
  streamText: { fontSize: typography.caption, color: palette.text, lineHeight: 20, marginTop: spacing.sm },
  dayBlock: { marginTop: spacing.lg },
  dayTitle: { color: palette.primary, fontWeight: '700', fontSize: typography.body },
  item: { color: palette.text, marginTop: spacing.xs, fontSize: typography.body },
});
