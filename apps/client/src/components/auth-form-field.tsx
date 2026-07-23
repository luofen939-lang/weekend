import { Input } from '@ant-design/react-native';
import type { ReactNode } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type KeyboardTypeOptions,
  type TextStyle,
  type TextInputProps,
} from 'react-native';

import { palette, radii, shadows, spacing, typography } from '@/theme';

export function AuthFormField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  autoComplete,
  maxLength,
  iconLabel,
  rightElement,
  showLabel = true,
  variant = 'default',
  allowClear = true,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoComplete?: TextInputProps['autoComplete'];
  maxLength?: number;
  iconLabel?: string;
  rightElement?: ReactNode;
  showLabel?: boolean;
  variant?: 'default' | 'pill';
  allowClear?: boolean;
}) {
  const inputMode =
    keyboardType === 'phone-pad'
      ? 'tel'
      : keyboardType === 'email-address'
        ? 'email'
        : keyboardType === 'number-pad'
          ? 'numeric'
          : undefined;
  const webInputReset =
    Platform.OS === 'web'
      ? ({ outlineStyle: 'none', outlineWidth: 0, boxShadow: 'none' } as unknown as TextStyle)
      : null;

  return (
    <View style={styles.field}>
      {showLabel ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.shell, variant === 'pill' && styles.pillShell]}>
        {iconLabel ? (
          <View style={styles.icon}>
            <Text style={styles.iconText}>{iconLabel}</Text>
          </View>
        ) : null}
        <Input
          allowClear={allowClear}
          accessibilityLabel={label}
          autoCapitalize="none"
          autoComplete={autoComplete}
          autoCorrect={false}
          keyboardType={keyboardType}
          maxLength={maxLength}
          placeholder={placeholder}
          placeholderTextColor={palette.placeholder}
          secureTextEntry={secureTextEntry}
          style={styles.inputWrap}
          inputStyle={[
            styles.input,
            variant === 'pill' && styles.pillInput,
            webInputReset,
          ]}
          value={value}
          onChangeText={onChangeText}
          {...Platform.select({
            web: { inputMode },
          })}
        />
        {rightElement ? <View style={styles.rightElement}>{rightElement}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  label: {
    color: palette.ink,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  shell: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.borderStrong,
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    ...shadows.card,
  },
  pillShell: {
    minHeight: 62,
    borderRadius: radii.pill,
    borderColor: 'rgba(255,255,255,0.96)',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 18,
    gap: 10,
  },
  icon: {
    width: 24,
    height: 24,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primarySoft,
  },
  iconText: {
    color: palette.primary,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  inputWrap: {
    minHeight: 46,
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
  },
  input: {
    color: palette.ink,
    fontSize: typography.body,
  },
  pillInput: {
    fontSize: 16,
    fontWeight: '800',
  },
  rightElement: {
    flexShrink: 0,
  },
});
