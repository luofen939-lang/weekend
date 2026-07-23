import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppIconName } from '@/components/app-icon';

export type MessageType = 'system' | 'activity' | 'diary';
export type MessageTab = '全部' | '未读' | '系统' | '互动';

export type MessageItem = {
  id: string;
  type: MessageType;
  icon: AppIconName;
  title: string;
  body: string;
  time: string;
  unread: boolean;
};

export const MESSAGE_TABS: MessageTab[] = ['全部', '未读', '系统', '互动'];

export const MESSAGES: MessageItem[] = [
  {
    id: 'weekly-checkin',
    type: 'system',
    icon: 'bell',
    title: '本周签到提醒',
    body: '连续签到 5 天可获得 1 次本周盲盒刷新次数，今天记得来补一下。',
    time: '刚刚',
    unread: true,
  },
  {
    id: 'diary-approved',
    type: 'diary',
    icon: 'message',
    title: '日记已发布',
    body: '你的出门日记已通过审核，现在可以在首页动态中被看到。',
    time: '2小时前',
    unread: true,
  },
  {
    id: 'todo-start',
    type: 'activity',
    icon: 'check',
    title: '约定可以开始啦',
    body: '本周约定已进入可执行状态，完成后记得回来写下体验。',
    time: '昨天',
    unread: true,
  },
  {
    id: 'vip-tip',
    type: 'system',
    icon: 'star',
    title: '会员权益更新',
    body: 'VIP 用户每周最多可保留 3 个约定，适合周末多安排几个轻计划。',
    time: '06-28',
    unread: false,
  },
];

const MESSAGE_READ_STORAGE_KEY = '@lazyde/message-read-ids';

export function getMessageReadStorageKey(userId?: number | null) {
  return `${MESSAGE_READ_STORAGE_KEY}:${userId ?? 'guest'}`;
}

export async function loadMessageReadIds(userId?: number | null): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(getMessageReadStorageKey(userId));
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    return [];
  }
}

export async function saveMessageReadIds(userId: number | null | undefined, readIds: string[]) {
  try {
    await AsyncStorage.setItem(getMessageReadStorageKey(userId), JSON.stringify(readIds));
  } catch {
    // ignore persistence errors
  }
}

export function getUnreadMessageCount(messages: readonly MessageItem[], readIds: readonly string[]) {
  return messages.filter((message) => message.unread && !readIds.includes(message.id)).length;
}

export function matchesMessageTab(tab: MessageTab, message: MessageItem, readIds: readonly string[]) {
  const unread = message.unread && !readIds.includes(message.id);

  if (tab === '全部') return true;
  if (tab === '未读') return unread;
  if (tab === '系统') return message.type === 'system';
  return message.type === 'activity' || message.type === 'diary';
}
