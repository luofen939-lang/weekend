import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useApp } from '@/contexts/app-context';
import { safeReturnTo } from '@/lib/safe-return-to';
import { useAppSelector } from '@/store/hooks';

type UseRequireAuthOptions = {
  /** 未登录时跳转登录页，并带上登录后返回地址 */
  returnTo: string;
  /** 为 true 时不自动跳转（由页面自行展示登录引导） */
  promptOnly?: boolean;
};

export function useRequireAuth({ returnTo, promptOnly = false }: UseRequireAuthOptions) {
  const router = useRouter();
  const { isRegistered, isBooting } = useApp();
  const authGateEnabled = useAppSelector((state) => state.ui.authGateEnabled);
  const safePath = safeReturnTo(returnTo) ?? '/';

  useEffect(() => {
    if (!authGateEnabled || promptOnly || isBooting || isRegistered) {
      return;
    }

    router.replace(`/login?returnTo=${encodeURIComponent(safePath)}`);
  }, [authGateEnabled, isBooting, isRegistered, promptOnly, router, safePath]);

  return {
    isBooting,
    isRegistered,
    allowed: !isBooting && (!authGateEnabled || isRegistered),
  };
}
