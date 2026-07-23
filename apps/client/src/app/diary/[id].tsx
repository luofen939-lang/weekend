import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AntDesign, Feather } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Image,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppShell } from '@/components/app-shell';
import { BackImageButton } from '@/components/back-image-button';
import { BottomSheet } from '@/components/bottom-sheet';
import { ErrorCard } from '@/components/error-card';
import { useApp } from '@/contexts/app-context';
import { useLayoutInsets } from '@/hooks/use-layout-insets';
import { backOrReplace } from '@/lib/safe-return-to';
import {
  createDiaryComment,
  getDiaryComments,
  getMyDiary,
  toggleDiaryLike,
  toggleDiaryCommentLike,
} from '@/services/api';
import { palette, spacing, typography } from '@/theme';
import type { DiaryCommentItem, MyDiaryItem } from '@/types';

type CommentReplyTarget = {
  id: number;
  author: string;
};

type InsertCommentResult = {
  inserted: boolean;
  items: DiaryCommentItem[];
};

const COVER_TONES = ['#E8F2E4', '#F5F2EA', '#F6EAEA', '#EAF4FF', '#F8E8E8', '#FFF7DD', '#EDF4FF', '#F2F0FF', '#EAF7FF'];

type WebShareNavigator = Navigator & {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
  clipboard?: {
    writeText?: (text: string) => Promise<void>;
  };
};

function normalizeDiaryId(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function safeSet(values: (string | undefined | null)[]) {
  return values.filter((value): value is string => Boolean(value));
}

function splitParagraphs(text: string) {
  const normalized = text.trim();
  if (!normalized) {
    return ['这篇日记还没有填写感受。'];
  }
  return normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function formatShortDate(value: string | undefined) {
  if (!value) return '';
  const normalized = value.replace('T', ' ').trim();
  const datePart = normalized.split(' ')[0];
  const match = datePart.match(/^\d{4}-(\d{2})-(\d{2})$/);

  if (!match) return '';
  return `${match[1]}-${match[2]}`;
}

function formatRelativeTime(value: string | undefined, now = new Date()) {
  if (!value) return '';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  const diffMs = Math.max(0, now.getTime() - parsed.getTime());
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return '刚刚';
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}分钟前`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}小时前`;

  const diffDays = Math.floor(diffMs / day);
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays}天前`;

  return formatShortDate(value);
}

function visibilityLabel(value: MyDiaryItem['visibility']) {
  if (value === 'public') return '公开';
  if (value === 'public_requested') return '待发布';
  return '仅自己可见';
}

function buildDiaryShareUrl(diaryId: number) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/diary/${diaryId}`;
  }

  return Linking.createURL(`/diary/${diaryId}`);
}

function buildDiaryShareMessage(record: MyDiaryItem, shareUrl: string) {
  return `我在懒得动看到一篇出门日记：${record.title}\n${record.summary}\n${shareUrl}`;
}

function buildCoverPages(record: MyDiaryItem, tags: string[]) {
  const pageLabels = [
    [
      record.cityName,
      record.district || record.cityName,
      tags[0] ?? '推荐',
      tags[1] ?? '今日',
      record.title,
      tags[2] ?? '日记',
      '路线',
      '心情',
      '回忆',
    ],
    [
      record.summary,
      tags[0] ?? record.cityName,
      tags[1] ?? (record.district || '周末'),
      '轻松出门',
      record.cityName,
      '今日灵感',
      tags[2] ?? '体验',
      '附近玩法',
      '值得再去',
    ],
    [
      '本次记录',
      record.district || record.cityName,
      formatShortDate(record.submittedAt || record.scheduledDate) || '今天',
      visibilityLabel(record.visibility),
      record.title,
      tags.join(' / '),
      '完成打卡',
      '城市碎片',
      '我的日记',
    ],
  ];

  return pageLabels.map((labels, pageIndex) =>
    labels.map((label, index) => ({
      id: `cover-${pageIndex}-${label}-${index}`,
      label,
      title: `${label}记录`,
      tone: COVER_TONES[(index + pageIndex * 2) % COVER_TONES.length],
    })),
  );
}

export default function DiaryDetailScreen() {
  const router = useRouter();
  const { bottom } = useLayoutInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const { user } = useApp();

  const diaryId = normalizeDiaryId(params.id);
  const [record, setRecord] = useState<MyDiaryItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [shareCount, setShareCount] = useState(8);
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [replyTarget, setReplyTarget] = useState<CommentReplyTarget | null>(null);
  const [comments, setComments] = useState<DiaryCommentItem[]>([]);
  const [isCommentListLoading, setIsCommentListLoading] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isUpdatingLikeId, setIsUpdatingLikeId] = useState<number | null>(null);
  const [isUpdatingDiaryLike, setIsUpdatingDiaryLike] = useState(false);
  const [activeCoverPage, setActiveCoverPage] = useState(0);
  const [coverPagerWidth, setCoverPagerWidth] = useState(0);
  const [expandedReplyIds, setExpandedReplyIds] = useState<number[]>([]);
  const [isTopLevelCommentsExpanded, setIsTopLevelCommentsExpanded] = useState(false);

  const loadDiary = useCallback(async () => {
    if (!Number.isFinite(diaryId) || diaryId <= 0) {
      setError('无效的日记 ID');
      setIsLoading(false);
      return;
    }

    if (!user) {
      setError('请先登录后查看日记');
      setIsLoading(false);
      return;
    }

    setError(null);
    try {
      const diary = await getMyDiary(diaryId);
      setRecord(diary);
      setIsLiked(Boolean(diary.isLikedByMe));
      setLikeCount(Number(diary.likes ?? 0));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '日记加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [diaryId, user]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadDiary();
    });
  }, [loadDiary]);

  const authorName = useMemo(
    () => (record?.authorName?.trim() ? record.authorName.trim() : '作者'),
    [record],
  );
  const authorAvatarText = useMemo(() => authorName.slice(0, 1), [authorName]);
  const authorAvatarSource = record?.authorAvatarUri ? { uri: record.authorAvatarUri } : null;
  const moodTags = useMemo(() => {
    const tags = safeSet([record?.mood, ...(record?.moodTags ?? [])]);
    const uniqueTags = [...new Set(tags)];
    return uniqueTags.length > 0 ? uniqueTags : ['出门', '日记'];
  }, [record]);
  const publishDate = useMemo(() => formatShortDate(record?.submittedAt || record?.scheduledDate), [record]);
  const publishMeta = useMemo(() => {
    if (!record) return '';
    return [publishDate, record.cityName, visibilityLabel(record.visibility)].filter(Boolean).join('  ');
  }, [publishDate, record]);
  const coverPages = useMemo(() => (record ? buildCoverPages(record, moodTags) : []), [moodTags, record]);
  const loadComments = useCallback(async ({ silent = false } = {}) => {
    if (!record) {
      return;
    }

    if (!silent) {
      setIsCommentListLoading(true);
    }
    try {
      const response = await getDiaryComments(record.id, { limit: 30 });
      setComments(response.items);
      setCommentCount(response.total);
    } catch (reason) {
      console.error('加载评论失败', reason);
      setComments([]);
      setCommentCount(0);
    } finally {
      if (!silent) {
        setIsCommentListLoading(false);
      }
    }
  }, [record]);

  useEffect(() => {
    if (record) {
      queueMicrotask(() => {
        void loadComments();
      });
    }
  }, [loadComments, record]);

  useEffect(() => {
    queueMicrotask(() => {
      setIsTopLevelCommentsExpanded(false);
    });
  }, [record]);

  useEffect(() => {
    if (!record) {
      return;
    }

    const timer = setInterval(() => {
      queueMicrotask(() => {
        void loadComments({ silent: true });
      });
    }, 8000);

    return () => {
      clearInterval(timer);
    };
  }, [loadComments, record]);

  const toggleLike = async () => {
    if (!record || isUpdatingDiaryLike) {
      return;
    }

    const action: 'like' | 'unlike' = isLiked ? 'unlike' : 'like';
    const nextIsLiked = action === 'like';

    setIsUpdatingDiaryLike(true);
    setIsLiked(nextIsLiked);
    setLikeCount((current) => Math.max(0, current + (nextIsLiked ? 1 : -1)));

    try {
      const response = await toggleDiaryLike(record.id, { action });

      setLikeCount(response.likes);
      setIsLiked(response.isLikedByMe);
      setRecord((current) =>
        current
          ? {
              ...current,
              likes: response.likes,
              isLikedByMe: response.isLikedByMe,
            }
          : current,
      );
    } catch (reason) {
      Alert.alert('点赞失败', reason instanceof Error ? reason.message : '请稍后再试');
      setLikeCount(Number(record.likes ?? 0));
      setIsLiked(Boolean(record.isLikedByMe));
    } finally {
      setIsUpdatingDiaryLike(false);
    }
  };

  const openCommentSheet = (target?: CommentReplyTarget) => {
    setReplyTarget(target ?? null);
    setCommentSheetVisible(true);
  };

  const closeCommentSheet = () => {
    setCommentSheetVisible(false);
    setReplyTarget(null);
    setCommentDraft('');
  };

  const submitComment = async () => {
    const body = commentDraft.trim();
    if (!body || !record || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      const created = await createDiaryComment(record.id, {
        body,
        parentCommentId: replyTarget?.id,
      });
      let inserted = false;
      setComments((current) => {
        const result = insertComment(current, created);
        inserted = result.inserted;
        return result.items;
      });
      const parentCommentId = created.parentCommentId;
      if (parentCommentId !== null) {
        setExpandedReplyIds((current) =>
          current.includes(parentCommentId)
            ? current
            : [...current, parentCommentId],
        );
      }
      setCommentDraft('');
      closeCommentSheet();
      if (!inserted) {
        await loadComments({ silent: true });
      } else {
        setCommentCount((current) => current + 1);
      }
    } catch (reason) {
      Alert.alert('评论发送失败', reason instanceof Error ? reason.message : '请稍后再试');
      await loadComments({ silent: true });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const insertComment = (source: DiaryCommentItem[], comment: DiaryCommentItem): InsertCommentResult => {
    if (!comment.parentCommentId) {
      return {
        inserted: true,
        items: [{ ...comment, replies: comment.replies ?? [] }, ...source],
      };
    }

    let inserted = false;
    const nextReplies = source.map((item) => {
      const next = insertReply(item, comment);
      if (next !== item) {
        inserted = true;
      }
      return next;
    });

    if (!inserted) {
      return { inserted: false, items: source };
    }

    return { inserted: true, items: nextReplies };
  };

  const insertReply = (comment: DiaryCommentItem, reply: DiaryCommentItem): DiaryCommentItem => {
    if (comment.id === reply.parentCommentId) {
      return {
        ...comment,
        replyCount: comment.replyCount + 1,
        replies: [...comment.replies, reply],
      };
    }

    if (!comment.replies.length) {
      return comment;
    }

    const nextReplies = comment.replies.map((item) => insertReply(item, reply));
    const changed = nextReplies.some((item, index) => item !== comment.replies[index]);

    if (!changed) {
      return comment;
    }

    return {
      ...comment,
      replies: nextReplies,
    };
  };

  const applyCommentLike = (items: DiaryCommentItem[], commentId: number, nextLikes: number, isLiked: boolean) => {
    const update = (list: DiaryCommentItem[]): DiaryCommentItem[] =>
      list.map((item) => {
        if (item.id === commentId) {
          return { ...item, likes: nextLikes, isLikedByMe: isLiked };
        }
        if (!item.replies.length) {
          return item;
        }

        return {
          ...item,
          replies: update(item.replies),
        };
      });

    return update(items);
  };

  const findCommentById = (items: DiaryCommentItem[], commentId: number): DiaryCommentItem | null => {
    for (const item of items) {
      if (item.id === commentId) {
        return item;
      }
      const nested = findCommentById(item.replies, commentId);
      if (nested) {
        return nested;
      }
    }

    return null;
  };

  const toggleCommentLike = async (commentId: number) => {
    const target = findCommentById(comments, commentId);
    if (!target || isUpdatingLikeId === commentId) {
      return;
    }

    const nextIsLiked = !target.isLikedByMe;
    const nextLikes = Math.max(0, target.likes + (nextIsLiked ? 1 : -1));
    setIsUpdatingLikeId(commentId);
    setComments((current) => applyCommentLike(current, commentId, nextLikes, nextIsLiked));
    try {
      const response = await toggleDiaryCommentLike(commentId, {
        action: target.isLikedByMe ? 'unlike' : 'like',
      });

      setComments((current) => applyCommentLike(current, response.id, response.likes, response.isLikedByMe));
    } catch (reason) {
      Alert.alert('点赞失败', reason instanceof Error ? reason.message : '请稍后再试');
      await loadComments({ silent: true });
    } finally {
      setIsUpdatingLikeId(null);
    }
  };

  const markShared = () => {
    if (!isShared) {
      setShareCount((current) => current + 1);
    }
    setIsShared(true);
  };

  const shareDiary = async () => {
    if (!record) return;

    const shareUrl = buildDiaryShareUrl(record.id);
    const message = buildDiaryShareMessage(record, shareUrl);

    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
        const webNavigator = navigator as WebShareNavigator;
        if (webNavigator.share) {
          await webNavigator.share({
            title: record.title,
            text: record.summary,
            url: shareUrl,
          });
          markShared();
          return;
        }

        if (webNavigator.clipboard?.writeText) {
          await webNavigator.clipboard.writeText(message);
          markShared();
          Alert.alert('已复制分享内容');
          return;
        }
      }

      await Share.share(
        {
          title: record.title,
          message,
          url: shareUrl,
        },
        { dialogTitle: '分享日记' },
      );
      markShared();
    } catch (reason: unknown) {
      if (reason instanceof Error && reason.name === 'AbortError') return;
      Alert.alert('分享失败', '可以稍后再试。');
    }
  };

  const handleCoverScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const pageWidth = nativeEvent.layoutMeasurement.width;
    if (pageWidth <= 0) return;

    const nextPage = Math.round(nativeEvent.contentOffset.x / pageWidth);
    setActiveCoverPage(Math.min(Math.max(nextPage, 0), Math.max(coverPages.length - 1, 0)));
  };

  const handleCoverLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const nextWidth = Math.round(nativeEvent.layout.width);
    if (nextWidth > 0 && nextWidth !== coverPagerWidth) {
      setCoverPagerWidth(nextWidth);
    }
  };

  const toggleReplyList = (commentId: number) => {
    setExpandedReplyIds((current) =>
      current.includes(commentId)
        ? current.filter((id) => id !== commentId)
        : [...current, commentId],
    );
  };

  const renderCommentItem = (comment: DiaryCommentItem, isNested = false, showExpandAfterComment = false) => {
    const canReply = true;
    const canRenderNested = !isNested;
    const isReplyExpanded = expandedReplyIds.includes(comment.id);
    const visibleReplies = canRenderNested && isReplyExpanded
      ? comment.replies
      : canRenderNested ? comment.replies.slice(0, 1) : [];
    const hasMoreReplies = canReply && canRenderNested && comment.replyCount > 2;
    const isExpanded = expandedReplyIds.includes(comment.id);
    const commentLocation = record?.cityName || '该位置';
    const replyToAuthor = comment.replyToAuthor?.trim()
      || (comment.parentCommentId ? findCommentById(comments, comment.parentCommentId)?.author : null);

    return (
      <View
        key={comment.id}
        style={[styles.commentItem, isNested && styles.nestedCommentItem]}
      >
        <View style={styles.commentAvatar}>
          {comment.authorAvatarUri ? (
            <Image accessibilityLabel={`${comment.author} 头像`} source={{ uri: comment.authorAvatarUri }} style={styles.commentAvatarImage} />
          ) : (
            <Text style={styles.commentAvatarText}>{comment.author.slice(0, 1)}</Text>
          )}
        </View>
        <View style={styles.commentContent}>
          <View style={styles.commentAuthorRow}>
            <Text numberOfLines={1} style={styles.commentAuthor}>{comment.author}</Text>
          </View>
          <Text style={styles.commentText}>
            {isNested && replyToAuthor ? (
              <>
                <Text style={styles.commentReplyTargetLabel}>回复</Text>
                <Text style={styles.commentReplyTargetName}>{` ${replyToAuthor} `}</Text>
              </>
            ) : null}
            {comment.body}
          </Text>
          <View style={styles.commentMetaRow}>
            <View style={styles.commentMetaTextWrap}>
              <Text numberOfLines={1} style={styles.commentMeta}>
                {formatRelativeTime(comment.createdAt) || '刚刚'}
              </Text>
              <Text style={styles.commentMetaSeparator}>·</Text>
              <Text numberOfLines={1} style={styles.commentMetaLocation}>
                {commentLocation}
              </Text>
              {canReply ? (
                <Pressable
                  accessibilityLabel={`回复 ${comment.author}`}
                  accessibilityRole="button"
                  onPress={() => openCommentSheet({ id: comment.id, author: comment.author })}
                  style={({ pressed }) => [styles.commentReplyButton, pressed && styles.pressed]}>
                  <Text style={styles.commentReplyText}>回复</Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={isUpdatingLikeId === comment.id}
              onPress={() => void toggleCommentLike(comment.id)}
              style={styles.commentLike}>
              {comment.isLikedByMe ? (
                <AntDesign name="heart" size={16} color="#F14D69" />
              ) : (
                <Feather name="heart" size={16} color="#7F8792" />
              )}
              {comment.likes > 0 ? (
                <Text style={[styles.commentLikeCount, comment.isLikedByMe && styles.activeText]}>
                  {comment.likes}
                </Text>
              ) : null}
            </Pressable>
          </View>

          {canReply && visibleReplies.length ? (
            <View style={styles.commentReplies}>
              {visibleReplies.map((reply) => renderCommentItem(reply, true))}
              {hasMoreReplies ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void toggleReplyList(comment.id)}
                  style={({ pressed }) => [
                    styles.expandRepliesButton,
                    isReplyExpanded ? styles.expandRepliesButtonExpanded : styles.expandRepliesButtonCollapsed,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.expandReplies}>
                    {isExpanded
                      ? `收起 ${comment.replyCount} 条回复`
                      : `展开剩余 ${comment.replyCount - 1} 条回复`}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {showExpandAfterComment ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsTopLevelCommentsExpanded(true)}
              style={({ pressed }) => [styles.commentMoreButton, pressed && styles.pressed]}>
              <Text style={styles.commentMoreText}>{`展开剩余 ${comments.length - 1} 条评论`}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  const showTopLevelMoreButton = comments.length > 2;
  const topLevelComments = showTopLevelMoreButton && !isTopLevelCommentsExpanded ? comments.slice(0, 1) : comments;

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={palette.primary} size="large" />
        <Text style={styles.loadingText}>正在加载日记...</Text>
      </View>
    );
  }

  if (!record) {
    return (
      <AppShell>
        <View style={styles.pageState}>
          <ErrorCard
            message={error ?? '日记不存在'}
            onRetry={() => {
              setIsLoading(true);
              void loadDiary();
            }}
          />
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <View style={styles.screen}>
        <View style={styles.header}>
          <BackImageButton onPress={() => backOrReplace(router)} style={styles.headerBack} />
          <View style={styles.headerAvatar}>
            {authorAvatarSource ? (
              <Image accessibilityLabel="头像" source={authorAvatarSource} style={styles.headerAvatarImage} />
            ) : (
              <Text style={styles.headerAvatarText}>{authorAvatarText}</Text>
            )}
          </View>
          <Text numberOfLines={1} style={styles.headerName}>{authorName}</Text>
          <Pressable
            accessibilityLabel="分享"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => void shareDiary()}
            style={({ pressed }) => [styles.headerShare, pressed && styles.headerActionPressed]}>
            <Feather name="share-2" size={20} color={isShared ? '#F14D69' : palette.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.contentContainer, { paddingBottom: bottom + 92 }]}
          showsVerticalScrollIndicator={false}>
          <View onLayout={handleCoverLayout} style={styles.coverPager}>
            <ScrollView
              horizontal
              onMomentumScrollEnd={handleCoverScroll}
              onScroll={handleCoverScroll}
              pagingEnabled
              scrollEventThrottle={16}
              showsHorizontalScrollIndicator={false}
              style={styles.coverPagerScroll}>
              {coverPages.map((page, pageIndex) => (
                <View
                  key={`cover-page-${pageIndex}`}
                  style={[styles.imageBlock, { width: coverPagerWidth || 1 }]}>
                  {page.map((tile) => (
                    <View key={tile.id} style={[styles.imageTile, { backgroundColor: tile.tone }]}>
                      <Text numberOfLines={1} style={styles.imageTileBrand}>{tile.label}</Text>
                      <Text numberOfLines={1} style={styles.imageTileTitle}>{tile.title}</Text>
                      <View style={styles.imageTileFigure}>
                        <Text style={styles.imageTileFigureText}>{authorAvatarText}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={styles.carouselDots}>
            {coverPages.map((_, index) => (
              <View
                key={`cover-dot-${index}`}
                style={[styles.carouselDot, index === activeCoverPage && styles.carouselDotActive]}
              />
            ))}
          </View>

          <View style={styles.postBody}>
            <Text style={styles.entryTitle}>{record.title}</Text>
            <Text style={styles.entrySummary}>{record.summary}</Text>
            {splitParagraphs(record.feelingText || '').map((paragraph, index) => (
              <Text key={`${paragraph}-${index}`} style={styles.feelingText}>
                {paragraph}
              </Text>
            ))}

            <View style={styles.moodWrap}>
              {moodTags.map((mood, index) => (
                <Text key={`${mood}-${index}`} style={styles.moodTagText}>#{mood}</Text>
              ))}
            </View>

            <View style={styles.postMetaRow}>
              <Text style={styles.locationText}>{publishMeta}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsDisliked((value) => !value)}
                style={({ pressed }) => [styles.dislikeButton, pressed && styles.pressed]}>
                <Feather name={isDisliked ? 'check-circle' : 'meh'} size={14} color={isDisliked ? '#F14D69' : '#666D78'} />
                <Text style={[styles.dislikeText, isDisliked && styles.activeText]}>
                  {isDisliked ? '已减少推荐' : '不喜欢'}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.commentSection}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentTitle}>共 {commentCount} 条评论</Text>
              <Feather name="menu" size={17} color="#7C838D" />
            </View>

            <View style={styles.commentComposer}>
              <Pressable accessibilityRole="button" onPress={() => openCommentSheet()} style={styles.composerInput}>
                <Text style={styles.composerPlaceholder}>让大家听到你的声音</Text>
              </Pressable>
            </View>

            {isCommentListLoading ? (
              <ActivityIndicator color={palette.primary} size="small" style={styles.commentLoading} />
            ) : comments.length > 0 ? (
              <>
                {topLevelComments.map((comment, index) =>
                  renderCommentItem(
                    comment,
                    false,
                    showTopLevelMoreButton && !isTopLevelCommentsExpanded && index === 0,
                  ),
                )}
                {isTopLevelCommentsExpanded ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setIsTopLevelCommentsExpanded(false)}
                    style={({ pressed }) => [styles.commentMoreButton, pressed && styles.pressed]}>
                    <Text style={styles.commentMoreText}>收起评论</Text>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <Text style={styles.emptyCommentsText}>还没有评论，打开第一条评论吧。</Text>
            )}
          </View>
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: bottom + 10 }]}>
          <Pressable accessibilityRole="button" onPress={() => openCommentSheet()} style={styles.bottomInput}>
            <Text style={styles.bottomInputText}>说点什么...</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isUpdatingDiaryLike}
            onPress={() => void toggleLike()}
            style={styles.bottomAction}>
            {isLiked ? (
              <AntDesign name="heart" size={20} color="#F14D69" />
            ) : (
              <Feather name="heart" size={20} color="#2B313A" />
            )}
            <Text style={styles.bottomActionText}>{likeCount}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => openCommentSheet()} style={styles.bottomAction}>
            <Feather name="message-circle" size={20} color="#2B313A" />
            <Text style={styles.bottomActionText}>{commentCount}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => void shareDiary()} style={styles.bottomAction}>
            <Feather name="share-2" size={19} color={isShared ? '#F14D69' : '#2B313A'} />
            <Text style={styles.bottomActionText}>{shareCount}</Text>
          </Pressable>
        </View>

        <BottomSheet
          edgeToEdge
          showCloseButton={false}
          title={replyTarget ? `回复 ${replyTarget.author}` : '写评论'}
          visible={commentSheetVisible}
          onClose={closeCommentSheet}>
          <View style={styles.commentSheetBody}>
            <TextInput
              autoFocus
              multiline
              maxLength={120}
              onChangeText={setCommentDraft}
              placeholder={replyTarget ? `回复 ${replyTarget.author}` : '爱评论的人运气都不差'}
              placeholderTextColor={palette.placeholder}
              style={styles.commentInput}
              value={commentDraft}
            />
            <View style={styles.commentToolRow}>
              <Pressable
                accessibilityRole="button"
                disabled={!commentDraft.trim() || isSubmittingComment}
                onPress={() => void submitComment()}
                style={({ pressed }) => [
                  styles.commentSubmitButton,
                  !commentDraft.trim() && styles.commentSubmitButtonDisabled,
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.commentSubmitText, !commentDraft.trim() && styles.commentSubmitTextDisabled]}>
                  发送
                </Text>
              </Pressable>
            </View>
          </View>
        </BottomSheet>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.canvas,
    gap: spacing.md,
  },
  loadingText: {
    color: palette.muted,
  },
  pageState: {
    padding: spacing.lg,
    minHeight: '100%',
  },
  header: {
    height: 62,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: palette.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  headerBack: {
    marginLeft: -8,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E9F1FF',
    borderWidth: 1,
    borderColor: 'rgba(20,24,32,0.08)',
  },
  headerAvatarText: {
    color: palette.primaryDark,
    fontSize: 18,
    fontWeight: '900',
  },
  headerAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 19,
  },
  headerName: {
    flex: 1,
    color: '#252B36',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  headerShare: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionPressed: {
    opacity: 0.78,
  },
  contentContainer: {
    backgroundColor: palette.surface,
  },
  coverPager: {
    width: '100%',
    backgroundColor: '#101010',
  },
  coverPagerScroll: {
    width: '100%',
  },
  imageBlock: {
    width: '100%',
    aspectRatio: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#101010',
  },
  imageTile: {
    width: '33.3333%',
    height: '33.3333%',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#101010',
  },
  imageTileBrand: {
    alignSelf: 'stretch',
    color: '#214069',
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  imageTileTitle: {
    alignSelf: 'stretch',
    color: '#0F1725',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  imageTileFigure: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderWidth: 1,
    borderColor: 'rgba(20,24,32,0.1)',
  },
  imageTileFigureText: {
    color: palette.primary,
    fontSize: 26,
    fontWeight: '900',
  },
  carouselDots: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  carouselDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D8D8D8',
  },
  carouselDotActive: {
    width: 6,
    height: 6,
    backgroundColor: '#F43B5D',
  },
  postBody: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  entryTitle: {
    color: '#1F2933',
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '800',
    marginBottom: 10,
  },
  entrySummary: {
    color: '#333A45',
    fontSize: 16,
    lineHeight: 25,
    marginBottom: 3,
  },
  feelingText: {
    color: '#333A45',
    fontSize: 16,
    lineHeight: 25,
  },
  moodWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 3,
    marginTop: 5,
  },
  moodTagText: {
    color: '#35546F',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  postMetaRow: {
    marginTop: 16,
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  locationText: {
    color: '#9399A3',
    fontSize: 13,
    lineHeight: 18,
  },
  dislikeButton: {
    paddingHorizontal: 2,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dislikeText: {
    color: '#666D78',
    fontSize: 13,
    lineHeight: 18,
  },
  divider: {
    height: 10,
    backgroundColor: palette.canvas,
  },
  commentSection: {
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: palette.surface,
  },
  commentHeader: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  commentTitle: {
    color: '#242A33',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  commentComposer: {
    marginTop: 14,
    marginBottom: 26,
    flexDirection: 'row',
    alignItems: 'center',
  },
  composerInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: 22,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.paper,
  },
  composerPlaceholder: {
    flex: 1,
    color: '#B2B7BF',
    fontSize: 14,
    lineHeight: 18,
  },
  commentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 24,
  },
  nestedCommentItem: {
    marginLeft: 0,
  },
  commentReplies: {
    marginTop: 14,
    marginLeft: 22,
  },
  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF3FF',
  },
  commentAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
  },
  commentAvatarText: {
    color: palette.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  commentContent: {
    flex: 1,
    minWidth: 0,
  },
  commentAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentAuthor: {
    flexShrink: 1,
    color: '#8C929D',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  commentReplyTargetLabel: {
    flexShrink: 0,
    color: '#A2A8B2',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  commentReplyTargetName: {
    flexShrink: 1,
    color: '#8C929D',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  commentBadge: {
    overflow: 'hidden',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    color: '#F35373',
    backgroundColor: '#FFEAF0',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
  },
  commentText: {
    color: '#242A33',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 5,
  },
  commentMetaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  commentMetaTextWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentMeta: {
    flexShrink: 1,
    color: '#9AA1AB',
    fontSize: 13,
    lineHeight: 18,
  },
  commentMetaSeparator: {
    color: '#B0B7C1',
    fontSize: 12,
    lineHeight: 18,
  },
  commentMetaLocation: {
    flexShrink: 1,
    color: '#9AA1AB',
    fontSize: 13,
    lineHeight: 18,
  },
  commentReplyButton: {
    paddingHorizontal: 2,
    paddingVertical: 3,
  },
  commentReplyText: {
    color: '#7F8792',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  commentLike: {
    minWidth: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    padding: 3,
  },
  commentLikeCount: {
    color: '#7F8792',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  commentReplyCount: {
    color: '#7F8792',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  expandReplies: {
    color: '#8D949F',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 0,
  },
  expandRepliesButton: {
    alignSelf: 'flex-start',
    marginBottom: 18,
    paddingVertical: 2,
    paddingRight: 8,
  },
  expandRepliesButtonCollapsed: {
    marginTop: 2,
  },
  expandRepliesButtonExpanded: {
    marginTop: 4,
  },
  commentLoading: {
    marginBottom: 26,
  },
  commentMoreButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingRight: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  commentMoreText: {
    color: '#8D949F',
    fontSize: 14,
    lineHeight: 20,
  },
  emptyCommentsText: {
    marginBottom: 26,
    color: '#8D949F',
    fontSize: 14,
    lineHeight: 20,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 58,
    paddingTop: 9,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: palette.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  bottomInput: {
    flex: 1,
    height: 38,
    borderRadius: 20,
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: palette.paper,
  },
  bottomInputText: {
    color: '#A4AAB3',
    fontSize: 14,
    lineHeight: 18,
  },
  bottomAction: {
    minWidth: 34,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomActionIcon: {
    color: '#2B313A',
    fontSize: 19,
    lineHeight: 21,
    fontWeight: '700',
  },
  bottomActionText: {
    color: '#4E5661',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
  },
  commentSheetBody: {
    gap: 12,
    paddingBottom: 0,
  },
  commentInput: {
    minHeight: 82,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: palette.paper,
    color: palette.text,
    fontSize: typography.body,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  commentToolRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  commentSubmitButton: {
    minWidth: 82,
    height: 42,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F14D69',
  },
  commentSubmitButtonDisabled: {
    backgroundColor: '#FFD5DF',
  },
  commentSubmitText: {
    color: palette.white,
    fontSize: typography.body,
    fontWeight: '900',
  },
  commentSubmitTextDisabled: {
    color: palette.white,
  },
  pressed: {
    opacity: 0.78,
  },
  activeText: {
    color: '#F14D69',
  },
});
