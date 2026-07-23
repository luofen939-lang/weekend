import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { EmailCodeAuthScreen } from '@/components/email-code-auth-screen';
import { useApp } from '@/contexts/app-context';
import { safeReturnTo } from '@/lib/safe-return-to';

export default function LoginScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const redirectPath = safeReturnTo(returnTo);
  const { login } = useApp();

  async function handleSubmit(input: { email: string; code: string }) {
    await login(input);
    if (redirectPath) {
      router.replace(redirectPath as Href);
    } else {
      router.replace('/');
    }
  }

  return (
    <EmailCodeAuthScreen mode="login" onSubmit={handleSubmit} showBack={false} />
  );
}
