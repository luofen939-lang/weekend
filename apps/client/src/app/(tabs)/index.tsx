import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { AppShell } from '@/components/app-shell';
import { HomeTopBar } from '@/components/home-top-bar';
import { useApp } from '@/contexts/app-context';
import { useLayoutInsets } from '@/hooks/use-layout-insets';
import { palette, radii, shadows, spacing, typography } from '@/theme';
import { getDiaryFeed } from '@/services/api';
import type { MyDiaryItem } from '@/types';

const home = {
  ink: palette.ink,
  muted: palette.muted,
  text: palette.text,
  paper: palette.canvas,
  surface: palette.surface,
  primary: palette.primary,
  primaryDark: palette.primaryDark,
  primarySoft: palette.primarySoft,
};

const MOOD_CHANNEL_FALLBACK = ['放松', '探索', '治愈', '社交', '热闹'];

type CommunityFeedItem = {
  id: string;
  emoji: string;
  title: string;
  author: string;
  likes: string;
  tag: string;
  tone: string;
  height: number;
  diaryId: number;
};

const COMMUNITY_FEED_PAGE_SIZE = 8;
const COMMUNITY_FEED_EMPTY_TEXT = {
  title: '该频道暂无内容',
  hint: '换到「推荐」频道，查看更多玩法清单。',
  action: '去推荐频道',
};
const COMMUNITY_FEED_END_TEXT = '已经到底了';
const COMMUNITY_FEED_EMOJIS = ['🌇', '☕️', '👟', '☂️', '🧭', '🍜', '🚶', '🏙️', '🌱', '☀️', '🎬', '🎨'];

const getFeedEmoji = (item: MyDiaryItem) => {
  const source = `${(item.moodTags ?? []).join('')} ${item.mood ?? ''} ${item.summary}`;
  if (source.includes('雨')) return '☂️';
  if (source.includes('美食')) return '🍜';
  if (source.includes('文艺') || source.includes('咖啡')) return '☕️';
  if (source.includes('探索') || source.includes('City Walk')) return '🧭';
  if (source.includes('社交')) return '👫';
  return COMMUNITY_FEED_EMOJIS[item.id % COMMUNITY_FEED_EMOJIS.length];
};

const getFeedAuthor = (item: MyDiaryItem) => {
  const target = item.cityName || item.district || item.summary;
  return target ? target.slice(0, 2) : '日记';
};

const getFeedTag = (item: MyDiaryItem) => {
  const tags = [item.mood ?? '', ...(item.moodTags ?? [])];
  return tags.find(Boolean) || '生活';
};

const getFeedTone = (item: MyDiaryItem) => {
  const mood = item.mood;
  if (mood === '探索') return '#8AA8FF';
  if (mood === '治愈') return '#7EC6A6';
  if (mood === '社交') return '#FFB26D';
  if (mood === '热闹') return '#F08A8A';
  return '#EAF4FF';
};

const getFeedHeight = (item: MyDiaryItem) => {
  const heights = [132, 138, 146, 154, 160, 162, 170, 178];
  return heights[item.id % heights.length];
};

const mapToCommunityFeedItem = (item: MyDiaryItem): CommunityFeedItem => ({
  id: `home-feed-${item.id}`,
  emoji: getFeedEmoji(item),
  title: item.title,
  author: getFeedAuthor(item),
  likes: String(item.attachmentCount + 20),
  tag: getFeedTag(item),
  tone: getFeedTone(item),
  height: getFeedHeight(item),
  diaryId: item.id,
});

const SCENE_IMAGE_WIDTH = 148;
const SCENE_IMAGE_GAP = 12;
const SCENE_STRIP_WIDTH = (SCENE_IMAGE_WIDTH + SCENE_IMAGE_GAP) * 5;

const SCENE_IMAGES = [
  require('../../../assets/images/blindbox-scene-cafe.png'),
  require('../../../assets/images/blindbox-scene-amusement.png'),
  require('../../../assets/images/blindbox-scene-park.png'),
  require('../../../assets/images/blindbox-scene-seaside.png'),
  require('../../../assets/images/blindbox-scene-picnic.png'),
];

const BLINDBOX_TITLE_ART = require('../../../assets/images/home-blindbox-title-art.png');
const COMMUNITY_FEED_ITEM_SPACING = 12;
const COMMUNITY_FEED_BODY_HEIGHT = 72;

const getBalancedColumns = (feed: readonly CommunityFeedItem[]) => {
  const columns: CommunityFeedItem[][] = [[], []];
  const heights = [0, 0];

  feed.forEach((note) => {
    const targetColumn = heights[0] <= heights[1] ? 0 : 1;
    columns[targetColumn].push(note);
    heights[targetColumn] += note.height + COMMUNITY_FEED_BODY_HEIGHT + COMMUNITY_FEED_ITEM_SPACING;
  });

  return columns;
};

const LOOPED_SCENE_IMAGES = [...SCENE_IMAGES, ...SCENE_IMAGES];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useLayoutInsets();
  const { options, user, selectedCityId, isBooting } = useApp();
  const [sceneMarqueeX] = useState(() => new Animated.Value(0));
  const [activeCommunityChannel, setActiveCommunityChannel] = useState('推荐');
  const [communityFeed, setCommunityFeed] = useState<CommunityFeedItem[]>([]);
  const [communityOffset, setCommunityOffset] = useState(0);
  const [communityHasMore, setCommunityHasMore] = useState(true);
  const [isLoadingCommunity, setIsLoadingCommunity] = useState(false);
  const [isLoadingMoreCommunity, setIsLoadingMoreCommunity] = useState(false);
  const communityRequestIdRef = useRef(0);
  const activeCommunityRequestRef = useRef(0);
  const communityLoadMoreThrottleRef = useRef(0);
  const communityChannels = useMemo(() => {
    const validMoods = (options?.moods ?? MOOD_CHANNEL_FALLBACK).filter((mood) =>
      mood && mood !== '随便',
    );
    return ['推荐', ...Array.from(new Set(validMoods))];
  }, [options?.moods]);
  const resolvedActiveCommunityChannel = communityChannels.includes(activeCommunityChannel)
    ? activeCommunityChannel
    : '推荐';
  const fallbackCommunityDiaryId = 9001;

  const activeCommunityFeed = useMemo(() => communityFeed, [communityFeed]);

  const communityColumns = useMemo(
    () => getBalancedColumns(activeCommunityFeed),
    [activeCommunityFeed],
  );

  const loadCommunityFeed = useCallback(
    async ({
      channel,
      existingFeed = [],
      hasMore = true,
      offset: requestedOffset = 0,
      reset = false,
    }: {
      channel: string;
      existingFeed?: CommunityFeedItem[];
      hasMore?: boolean;
      offset?: number;
      reset?: boolean;
    }) => {
      const requestId = ++communityRequestIdRef.current;
      const isReset = Boolean(reset);
      const offset = isReset ? 0 : requestedOffset;

      if (isReset) {
        setIsLoadingCommunity(true);
      } else {
        if (activeCommunityRequestRef.current || !hasMore) return;
        setIsLoadingMoreCommunity(true);
      }

      activeCommunityRequestRef.current = requestId;

      try {
        const response = await getDiaryFeed({
          moods: channel === '推荐' ? undefined : [channel],
          limit: COMMUNITY_FEED_PAGE_SIZE,
          offset,
        });
        const mappedItems = response.items.map(mapToCommunityFeedItem);

        if (requestId !== communityRequestIdRef.current) return;

        const dedupedItems = isReset
          ? mappedItems
          : mappedItems.filter((item) => existingFeed.every((note) => note.id !== item.id));

        if (!isReset && dedupedItems.length === 0) {
          setCommunityHasMore(false);
          return;
        }

        if (isReset) {
          setCommunityFeed(dedupedItems);
        } else {
          setCommunityFeed((previous) => [...previous, ...dedupedItems]);
        }
        const nextOffset = offset + mappedItems.length;
        setCommunityOffset(nextOffset);
        setCommunityHasMore(nextOffset < response.total && dedupedItems.length > 0);
      } catch (error) {
        if (requestId === communityRequestIdRef.current) {
          setCommunityHasMore(false);
        }
        if (__DEV__) {
          console.error('首页动态加载失败', error);
        }
      } finally {
        if (requestId === communityRequestIdRef.current) {
          activeCommunityRequestRef.current = 0;
          if (isReset) {
            setIsLoadingCommunity(false);
          } else {
            setIsLoadingMoreCommunity(false);
          }
        }
      }
    },
    [],
  );

  const onCommunityScroll = useCallback(
    ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
      const threshold = 220;
      const { contentOffset, layoutMeasurement, contentSize } = nativeEvent;
      const reachedBottom =
        layoutMeasurement.height + contentOffset.y >= contentSize.height - threshold;
      if (!reachedBottom) return;
      if (!communityHasMore || isLoadingCommunity || isLoadingMoreCommunity || communityFeed.length === 0) return;
      const now = Date.now();
      if (now - communityLoadMoreThrottleRef.current < 600) return;
      communityLoadMoreThrottleRef.current = now;
      void loadCommunityFeed({
        channel: resolvedActiveCommunityChannel,
        existingFeed: communityFeed,
        hasMore: communityHasMore,
        offset: communityOffset,
      });
    },
    [
      communityHasMore,
      communityOffset,
      isLoadingCommunity,
      isLoadingMoreCommunity,
      communityFeed,
      loadCommunityFeed,
      resolvedActiveCommunityChannel,
    ],
  );

  const goExplore = () => {
    if (selectedCityId) router.push('/preferences');
  };

  const goCommunityFeedDetail = (note: CommunityFeedItem) => {
    const diaryId = Number.isFinite(note.diaryId) && note.diaryId > 0 ? note.diaryId : fallbackCommunityDiaryId;
    router.push({ pathname: '/diary/[id]', params: { id: String(diaryId) } });
  };

  useEffect(() => {
    const loadTimer = setTimeout(() => {
      void loadCommunityFeed({
        channel: resolvedActiveCommunityChannel,
        reset: true,
      });
    }, 0);

    return () => clearTimeout(loadTimer);
  }, [loadCommunityFeed, resolvedActiveCommunityChannel, user?.id]);

  useEffect(() => {
    sceneMarqueeX.setValue(0);
    const sceneLoop = Animated.loop(
      Animated.timing(sceneMarqueeX, {
        toValue: -SCENE_STRIP_WIDTH,
        duration: 22000,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );

    sceneLoop.start();
    return () => sceneLoop.stop();
  }, [sceneMarqueeX]);

  if (isBooting) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ActivityIndicator color={home.primary} size="large" />
        <Text style={styles.loadingText}>正在加载…</Text>
      </View>
    );
  }

  return (
    <AppShell>
      <View style={styles.screen}>
        <HomeTopBar />
        <ScrollView
          onScroll={onCommunityScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.page, { paddingBottom: insets.tabBarHeight + 20 }]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.mysteryCard}>
            <View style={styles.mysteryWarmWash} />
            <View style={styles.mysteryCoolWash} />
            <View style={styles.mysteryGlowPrimary} />
            <View style={styles.mysteryGlowWarm} />

            <Text style={styles.mysteryBadge}>免费抽取 3 次</Text>
            <Image
              accessibilityLabel="今天去哪儿，让盲盒替你决定"
              source={BLINDBOX_TITLE_ART}
              allowDownscaling
              cachePolicy="memory-disk"
              contentFit="contain"
              style={styles.mysteryTitleArt}
            />

            <View style={styles.mysterySceneCarousel}>
              <Animated.View
                style={[
                  styles.mysterySceneTrack,
                  { transform: [{ translateX: sceneMarqueeX }] },
                ]}>
                {LOOPED_SCENE_IMAGES.map((source, index) => (
                  <Image
                    key={`scene-${index}`}
                    source={source}
                    allowDownscaling
                    cachePolicy="memory-disk"
                    contentFit="cover"
                    style={styles.mysterySceneImage}
                  />
                ))}
              </Animated.View>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={goExplore}
              style={({ pressed }) => [styles.mysteryAction, pressed && styles.pressed]}>
              <Text style={styles.mysteryActionText}>立即抽盲盒</Text>
            </Pressable>

            <View style={styles.mysteryBottomPills}>
              <Text style={styles.mysteryHint}>
                AI 会根据你的选择，生成一个足够轻、能真正出门的约定。
              </Text>
            </View>
          </View>

          <View style={styles.communitySection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.communityChannelRow}>
              {communityChannels.map((channel) => {
                const active = resolvedActiveCommunityChannel === channel;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={channel}
                    onPress={() => setActiveCommunityChannel(channel)}
                    style={styles.communityChannel}>
                    <Text
                      style={[styles.communityChannelText, active && styles.communityChannelTextActive]}>
                      {channel}
                    </Text>
                    {active ? <View style={styles.communityChannelLine} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            {communityColumns[0].length > 0 || communityColumns[1].length > 0 ? (
              <View style={styles.communityWaterfall}>
                {communityColumns.map((column, columnIndex) => (
                  <View key={columnIndex} style={styles.communityColumn}>
                    {column.map((note) => (
                      <Pressable
                        accessibilityRole="button"
                        key={note.id}
                        onPress={() => goCommunityFeedDetail(note)}
                        style={({ pressed }) => [styles.communityFeedItem, pressed && styles.pressed]}>
                        <View
                          style={[
                            styles.communityFeedCover,
                            { height: note.height, backgroundColor: note.tone },
                          ]}>
                          <View style={styles.communityFeedOrb} />
                          <Text style={styles.communityFeedEmoji}>{note.emoji}</Text>
                          <View style={styles.communityFeedTag}>
                            <Text style={styles.communityFeedTagText}>{note.tag}</Text>
                          </View>
                        </View>
                        <Text style={styles.communityFeedTitle}>{note.title}</Text>
                        <View style={styles.communityFeedMeta}>
                          <View style={styles.communityAvatar}>
                            <Text style={styles.communityAvatarText}>{note.author.slice(0, 1)}</Text>
                          </View>
                          <Text style={styles.communityAuthor} numberOfLines={1}>
                            {note.author}
                          </Text>
                          <AppIcon name="like" size={12} color={home.muted} />
                          <Text style={styles.communityLike}>{note.likes}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.communityEmpty}>
                {isLoadingCommunity ? (
                  <>
                    <ActivityIndicator color={home.primary} />
                    <Text style={styles.communityEmptyHint}>正在加载动态…</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.communityEmptyTitle}>
                      {COMMUNITY_FEED_EMPTY_TEXT.title}
                    </Text>
                    <Text style={styles.communityEmptyHint}>{COMMUNITY_FEED_EMPTY_TEXT.hint}</Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setActiveCommunityChannel('推荐')}
                      style={({ pressed }) => [styles.communityEmptyAction, pressed && styles.pressed]}>
                      <Text style={styles.communityEmptyActionText}>
                        {COMMUNITY_FEED_EMPTY_TEXT.action}
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
            )}
            {isLoadingMoreCommunity ? (
              <View style={styles.communityLoadMore}>
                <ActivityIndicator color={home.primary} size="small" />
              </View>
            ) : !communityHasMore && communityFeed.length > 0 ? (
              <Text style={styles.communityEndText}>{COMMUNITY_FEED_END_TEXT}</Text>
            ) : null}

          </View>
        </ScrollView>
      </View>
    </AppShell>
  );
}

const feedShadow = Platform.select({
  web: { boxShadow: '0 12px 28px rgba(84, 70, 175, 0.18)' },
  default: {
    shadowColor: '#5446AF',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: home.paper },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: home.paper, gap: spacing.md },
  loadingText: { color: home.muted, fontSize: typography.body },
  page: { gap: 16, backgroundColor: home.paper },
  mysteryCard: {
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 32,
    backgroundColor: '#EEF7FF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
    position: 'relative',
    ...shadows.elevated,
  },
  mysteryWarmWash: {
    position: 'absolute',
    left: -48,
    bottom: -66,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(255,226,206,0.78)',
  },
  mysteryCoolWash: {
    position: 'absolute',
    right: -18,
    bottom: -18,
    width: 236,
    height: 236,
    borderRadius: 118,
    backgroundColor: 'rgba(255,248,207,0.72)',
  },
  mysteryGlowPrimary: {
    position: 'absolute',
    right: -10,
    top: -42,
    width: 164,
    height: 164,
    borderRadius: 82,
    backgroundColor: 'rgba(117,101,246,0.16)',
  },
  mysteryGlowWarm: {
    position: 'absolute',
    left: -12,
    top: -26,
    width: 122,
    height: 122,
    borderRadius: 61,
    backgroundColor: 'rgba(213,244,255,0.82)',
  },
  mysteryBadge: {
    position: 'relative',
    zIndex: 1,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,249,221,0.95)',
    color: '#5A4615',
    fontSize: 13,
    fontWeight: '900',
  },
  mysteryTitleArt: {
    position: 'relative',
    zIndex: 1,
    alignSelf: 'stretch',
    width: '100%',
    height: 136,
    marginTop: 18,
    marginBottom: 6,
  },
  mysterySceneCarousel: {
    position: 'relative',
    zIndex: 1,
    height: 158,
    marginTop: 12,
    marginHorizontal: -4,
    overflow: 'hidden',
  },
  mysterySceneTrack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mysterySceneImage: {
    width: SCENE_IMAGE_WIDTH,
    height: 148,
    marginRight: SCENE_IMAGE_GAP,
    borderRadius: 24,
    overflow: 'hidden',
  },
  mysteryAction: {
    position: 'relative',
    zIndex: 1,
    height: 54,
    marginTop: 16,
    borderRadius: 28,
    backgroundColor: home.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.primaryButton,
  },
  mysteryActionText: {
    color: home.surface,
    fontSize: 18,
    fontWeight: '900',
  },
  mysteryBottomPills: {
    position: 'relative',
    zIndex: 1,
    marginTop: 14,
  },
  mysteryHint: {
    color: home.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
    opacity: 0.72,
    textAlign: 'center',
  },
  communitySection: {
    marginHorizontal: 20,
    gap: 14,
  },
  communityChannelRow: {
    gap: 22,
    paddingRight: 20,
  },
  communityChannel: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  communityChannelText: {
    color: home.muted,
    fontSize: 15,
    fontWeight: '800',
  },
  communityChannelTextActive: {
    color: home.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  communityChannelLine: {
    position: 'absolute',
    left: 1,
    right: 1,
    bottom: 0,
    height: 3,
    borderRadius: 99,
    backgroundColor: home.primary,
  },
  communityWaterfall: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  communityColumn: {
    flex: 1,
    gap: 12,
  },
  communityFeedItem: {
    gap: 8,
    padding: 0,
    borderRadius: 20,
    backgroundColor: 'transparent',
    overflow: 'visible',
    ...feedShadow,
  },
  communityFeedCover: {
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  communityFeedOrb: {
    position: 'absolute',
    right: -24,
    top: 22,
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  communityFeedEmoji: {
    fontSize: 38,
  },
  communityFeedTag: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  communityFeedTagText: {
    color: home.primary,
    fontSize: 10,
    fontWeight: '900',
  },
  communityFeedTitle: {
    paddingHorizontal: 12,
    paddingTop: 2,
    color: home.ink,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 20,
  },
  communityFeedMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  communityEmpty: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: '#fff',
    alignItems: 'center',
    gap: 8,
  },
  communityEmptyTitle: {
    color: home.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  communityEmptyHint: {
    color: home.muted,
    fontSize: 12,
    textAlign: 'center',
  },
  communityEmptyAction: {
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: home.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  communityEmptyActionText: {
    color: home.surface,
    fontWeight: '900',
  },
  communityLoadMore: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  communityEndText: {
    color: home.muted,
    fontSize: typography.caption,
    textAlign: 'center',
    paddingVertical: 20,
  },
  communityAvatar: {
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: home.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  communityAvatarText: {
    color: home.primary,
    fontSize: 10,
    fontWeight: '900',
  },
  communityAuthor: {
    flex: 1,
    color: home.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  communityLike: {
    color: home.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  pressed: { opacity: 0.9 },
});
