import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useLayoutInsets } from '@/hooks/use-layout-insets';

/** Web：同步机型 profile / model 到 <html data-*>，供 global.css 使用 */
export function DeviceProfileSync() {
  const { profile, model } = useLayoutInsets();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.dataset.deviceProfile = profile;
    document.documentElement.dataset.deviceModel = model;
  }, [profile, model]);

  return null;
}
