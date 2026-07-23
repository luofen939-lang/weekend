import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { EmailCodeAuthScreen } from '@/components/email-code-auth-screen';
import { useApp } from '@/contexts/app-context';
import { backOrReplace, safeReturnTo } from '@/lib/safe-return-to';

export default function RegisterScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const redirectPath = safeReturnTo(returnTo);
  const { register } = useApp();

  async function handleSubmit(input: { email: string; code: string }) {
    await register(input);
    if (redirectPath) {
      router.replace(redirectPath as Href);
    } else {
      backOrReplace(router);
    }
  }

  return (
    <EmailCodeAuthScreen mode="register" onBack={() => backOrReplace(router)} onSubmit={handleSubmit} />
  );
}
