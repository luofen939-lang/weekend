import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { AppShell } from '@/components/app-shell';
import { AuthFormField } from '@/components/auth-form-field';
import { BackImageButton } from '@/components/back-image-button';
import { requestAuthCode } from '@/services/api';
import { palette, radii, shadows, spacing, typography } from '@/theme';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const codePattern = /^\d{6}$/;

type EmailCodeAuthScreenProps = {
  mode: 'login' | 'register';
  onBack?: () => void;
  onSubmit: (input: { email: string; code: string }) => Promise<void>;
  showBack?: boolean;
};

export function EmailCodeAuthScreen({
  mode,
  onBack,
  onSubmit,
  showBack = true,
}: EmailCodeAuthScreenProps) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeHint, setCodeHint] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = setTimeout(() => setCountdown((value) => Math.max(0, value - 1)), 1_000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const copy =
    mode === 'login'
      ? {
          footer: '未注册邮箱将自动创建账号',
        }
      : {
          footer: '已有账号会直接登录',
        };

  function validateEmail() {
    if (!emailPattern.test(email.trim())) {
      setFormError('请输入正确的邮箱');
      return false;
    }
    return true;
  }

  async function handleSendCode() {
    if (!validateEmail() || countdown > 0 || sendingCode) {
      return;
    }

    setFormError(null);
    setCodeHint(null);
    setSendingCode(true);
    try {
      const ticket = await requestAuthCode(email.trim().toLowerCase());
      setCountdown(ticket.retryAfterSeconds);
      if (ticket.devCode) {
        setCode(ticket.devCode);
        setCodeHint('测试验证码已自动填入');
      } else {
        setCodeHint('验证码已发送，请查收邮箱');
      }
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : '验证码发送失败');
    } finally {
      setSendingCode(false);
    }
  }

  async function handleSubmit() {
    if (!validateEmail()) {
      return;
    }
    if (!codePattern.test(code.trim())) {
      setFormError('请输入 6 位验证码');
      return;
    }
    if (!agreed) {
      setFormError('请先阅读并同意相关协议');
      return;
    }

    setFormError(null);
    setLoading(true);
    try {
      await onSubmit({ email: email.trim().toLowerCase(), code: code.trim() });
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }

  const codeButtonText = sendingCode ? '发送中' : countdown > 0 ? `${countdown}s` : '获取验证码';

  return (
    <AppShell>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled">
        <View pointerEvents="none" style={styles.topWash} />
        <View pointerEvents="none" style={styles.bottomWash} />

        {showBack && onBack ? <BackImageButton onPress={onBack} style={styles.backButton} /> : null}

        <View style={styles.content}>
          <View style={styles.brand}>
            <Image
              accessibilityIgnoresInvertColors
              resizeMode="contain"
              source={require('../../assets/images/auth-logo.png')}
              style={styles.authLogoImage}
            />
          </View>

          <View style={styles.form}>
            <AuthFormField
              allowClear={false}
              autoComplete="email"
              keyboardType="email-address"
              label="邮箱"
              maxLength={255}
              placeholder="请输入邮箱..."
              showLabel={false}
              value={email}
              variant="pill"
              onChangeText={(value) => {
                setEmail(value);
                setCodeHint(null);
              }}
            />
            <AuthFormField
              allowClear={false}
              autoComplete="sms-otp"
              keyboardType="number-pad"
              label="验证码"
              maxLength={6}
              placeholder="请输入验证码..."
              rightElement={
                <Pressable
                  accessibilityRole="button"
                  disabled={countdown > 0 || sendingCode}
                  onPress={() => void handleSendCode()}
                  style={[styles.codeButton, (countdown > 0 || sendingCode) && styles.disabledCodeButton]}>
                  <Text
                    style={[
                      styles.codeButtonText,
                      (countdown > 0 || sendingCode) && styles.disabledCodeButtonText,
                    ]}>
                    {codeButtonText}
                  </Text>
                </Pressable>
              }
              showLabel={false}
              value={code}
              variant="pill"
              onChangeText={setCode}
            />

            {codeHint ? <Text style={styles.codeHint}>{codeHint}</Text> : null}
            {formError ? <Text style={styles.error}>{formError}</Text> : null}

            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={() => void handleSubmit()}
              style={({ pressed }) => [
                styles.submitButton,
                (pressed || loading) && styles.pressedSubmitButton,
              ]}>
              <Text style={styles.submitText}>{loading ? '请稍候...' : '登录 / 注册'}</Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
            onPress={() => setAgreed((value) => !value)}
            style={styles.agreement}>
            <View style={[styles.check, agreed && styles.checked]}>
              {agreed ? <AppIcon name="check" size={12} color={palette.white} /> : null}
            </View>
            <Text style={styles.agreeText}>
              已阅读并同意 <Text style={styles.agreeLink}>《用户协议》</Text>
              <Text style={styles.agreeLink}>《隐私政策》</Text>
              <Text style={styles.agreeLink}>《AI 功能使用须知》</Text>
            </Text>
          </Pressable>

          <Text style={styles.footer}>{copy.footer}</Text>
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  page: {
    flexGrow: 1,
    position: 'relative',
    overflow: 'hidden',
    paddingHorizontal: 28,
    paddingTop: 50,
    paddingBottom: 24,
  },
  topWash: {
    position: 'absolute',
    top: -118,
    left: 0,
    right: 0,
    height: 280,
    borderBottomLeftRadius: 140,
    borderBottomRightRadius: 140,
    backgroundColor: '#DFFBFF',
  },
  bottomWash: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -150,
    height: 300,
    borderTopLeftRadius: 160,
    borderTopRightRadius: 160,
    backgroundColor: '#FFF8EC',
  },
  backButton: {
    position: 'absolute',
    top: 12,
    left: 20,
    zIndex: 2,
  },
  content: {
    width: '100%',
    maxWidth: 390,
    flexGrow: 1,
    alignSelf: 'center',
    alignItems: 'center',
  },
  brand: {
    alignItems: 'center',
    marginTop: 44,
  },
  authLogoImage: {
    width: 150,
    height: 150,
  },
  illustration: {
    position: 'relative',
    width: 136,
    height: 118,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bucket: {
    position: 'relative',
    width: 116,
    height: 88,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    borderWidth: 3,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    transform: [{ rotate: '-4deg' }],
    ...shadows.elevated,
  },
  bucketHandle: {
    position: 'absolute',
    top: -20,
    left: 20,
    right: 20,
    height: 38,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderColor: palette.ink,
    borderTopLeftRadius: 38,
    borderTopRightRadius: 38,
    transform: [{ rotate: '8deg' }],
  },
  bucketText: {
    color: palette.ink,
    fontSize: 36,
    fontWeight: '900',
  },
  bucketMark: {
    position: 'absolute',
    right: 18,
    top: 18,
    width: 28,
    height: 16,
    borderRadius: 14,
    backgroundColor: palette.primaryLight,
    transform: [{ rotate: '-24deg' }],
  },
  pin: {
    position: 'absolute',
    right: 12,
    top: 10,
    width: 28,
    height: 28,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#56D3FF',
    transform: [{ rotate: '14deg' }],
  },
  pinText: {
    color: palette.white,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  title: {
    marginTop: 18,
    color: palette.ink,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
  },
  titleMark: {
    width: 74,
    height: 10,
    marginTop: 5,
    borderRadius: radii.pill,
    backgroundColor: '#56D3FF',
    transform: [{ rotate: '-10deg' }],
  },
  form: {
    width: '100%',
    marginTop: 44,
    gap: 14,
  },
  codeButton: {
    minWidth: 82,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primarySoft,
  },
  disabledCodeButton: {
    backgroundColor: palette.paper,
  },
  codeButtonText: {
    color: palette.primary,
    fontSize: typography.caption + 1,
    fontWeight: '900',
  },
  disabledCodeButtonText: {
    color: palette.muted,
  },
  error: {
    color: palette.error,
    fontSize: typography.caption,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
  },
  codeHint: {
    color: palette.primary,
    fontSize: typography.caption,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
  },
  submitButton: {
    width: '100%',
    minHeight: 62,
    marginTop: spacing.lg,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.ink,
    ...shadows.elevated,
  },
  pressedSubmitButton: {
    opacity: 0.82,
  },
  submitText: {
    color: palette.white,
    fontSize: typography.h2,
    fontWeight: '900',
  },
  agreement: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 18,
    paddingHorizontal: spacing.sm,
  },
  check: {
    width: 18,
    height: 18,
    marginTop: 2,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#D8D3EE',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.white,
  },
  checked: {
    borderColor: palette.primary,
    backgroundColor: palette.primary,
  },
  agreeText: {
    flex: 1,
    color: palette.muted,
    fontSize: typography.caption,
    lineHeight: 19,
    fontWeight: '800',
  },
  agreeLink: {
    color: palette.primary,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: spacing.xl,
    color: 'rgba(124,119,163,0.82)',
    fontSize: typography.caption,
    fontWeight: '800',
    textAlign: 'center',
  },
});
