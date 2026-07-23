import { type PropsWithChildren } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useRequireAuth } from '@/hooks/use-require-auth';
import { palette } from '@/theme';

type RequireAuthProps = PropsWithChildren<{
  returnTo: string;
}>;

/** 未登录时重定向到登录页，登录成功后回到 returnTo */
export function RequireAuth({ children, returnTo }: RequireAuthProps) {
  const { allowed, isBooting } = useRequireAuth({ returnTo });

  if (isBooting || !allowed) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={palette.primary} size="large" />
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.canvas,
  },
});
