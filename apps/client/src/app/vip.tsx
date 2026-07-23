import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Linking, Platform } from 'react-native';

import { DesignPage } from '@/components/design-page';
import { useApp } from '@/contexts/app-context';
import { createVipAlipayPayment, getPaymentOrder } from '@/services/api';

function getSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function buildPaymentReturnUrl() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return undefined;
  }

  const url = new URL('/vip', window.location.origin);
  url.searchParams.set('payment', 'return');
  return url.toString();
}

function formatMembershipExpiry(value: string | null | undefined) {
  if (!value) {
    return '永久有效';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '同步中';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

export default function VipScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ out_trade_no?: string | string[]; payment?: string | string[] }>();
  const { user, isRegistered, refreshCurrentUser, refreshProfileProgress } = useApp();
  const [isPaying, setIsPaying] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const handledReturnOrderRef = useRef<string | null>(null);
  const membership = user?.membership;
  const isVip = Boolean(isRegistered && membership?.isVip);
  const vipExpiryLabel = isVip ? formatMembershipExpiry(membership?.expiresAt) : '开通后显示';
  const primaryLabel = isCheckingPayment
    ? '正在确认支付...'
    : isVip
      ? '¥18/月 续费奇遇会员'
      : '¥18/月 开通奇遇会员';

  useEffect(() => {
    const orderNo = getSearchParam(params.out_trade_no);
    if (!orderNo || handledReturnOrderRef.current === orderNo) {
      return;
    }

    handledReturnOrderRef.current = orderNo;
    setIsCheckingPayment(true);

    getPaymentOrder(orderNo)
      .then(async (order) => {
        if (order.status === 'paid') {
          await refreshCurrentUser().catch(() => undefined);
          await refreshProfileProgress().catch(() => undefined);
          Alert.alert('会员已开通', '奇遇会员已经生效。');
          router.replace('/profile');
          return;
        }

        if (order.status === 'closed' || order.status === 'failed') {
          Alert.alert('支付未完成', '这笔订单未完成支付，可以重新开通。');
          return;
        }

        Alert.alert('支付确认中', '沙箱订单还在确认中，请稍后再进入会员页查看。');
      })
      .catch((reason) => {
        Alert.alert('支付确认失败', reason instanceof Error ? reason.message : '请稍后重试。');
      })
      .finally(() => setIsCheckingPayment(false));
  }, [params.out_trade_no, refreshCurrentUser, refreshProfileProgress, router]);

  async function handleOpenAlipay() {
    if (isPaying || isCheckingPayment) {
      return;
    }

    if (!isRegistered) {
      router.push({ pathname: '/login', params: { returnTo: '/vip' } });
      return;
    }

    setIsPaying(true);
    try {
      const payment = await createVipAlipayPayment(buildPaymentReturnUrl());
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.assign(payment.paymentUrl);
        return;
      }

      await Linking.openURL(payment.paymentUrl);
    } catch (reason) {
      Alert.alert('无法开通会员', reason instanceof Error ? reason.message : '请稍后重试。');
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <DesignPage
      title="充值"
      step="11 / 16"
      badge="奇遇会员"
      heroTitle="让更多心动方案留下来"
      heroBody="三次抽卡都能留下，每周多保留一点心动选择。"
      heroMascotSource={require('../../assets/mascots/diary-cat.png')}
      showMore={false}
      metrics={[
        { label: '月卡价格', value: '¥18' },
        { label: '会员状态', value: isVip ? '已开通' : '未开通' },
        { label: '有效期', value: vipExpiryLabel },
      ]}
      sections={[
        {
          title: '会员权益',
          items: ['三次抽卡机会都可以成为约定', '每周约定最多存 3 个', '1 个心动约定可冻结延期 2 周', '头像挂饰与专属成长标识'],
          itemIcons: ['spark', 'heart', 'timer', 'star'],
          emphasis: 'featured',
          tone: 'primary',
        },
      ]}
      primary={{
        label: primaryLabel,
        loading: isPaying || isCheckingPayment,
        onPress: () => void handleOpenAlipay(),
      }}
    />
  );
}
