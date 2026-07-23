import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { AppShell } from '@/components/app-shell';
import { BottomSheet } from '@/components/bottom-sheet';
import { InnerPageHeader } from '@/components/inner-page-header';
import { useApp } from '@/contexts/app-context';
import { useLayoutInsets } from '@/hooks/use-layout-insets';
import { backOrReplace } from '@/lib/safe-return-to';
import { uploadUserAvatar } from '@/services/api';
import { palette, radii, shadows, spacing, typography } from '@/theme';
import type { AccountGender } from '@/types';

const GENDER_OPTIONS: { label: string; value: AccountGender }[] = [
  { label: '男', value: 'male' },
  { label: '女', value: 'female' },
  { label: '不便透露', value: 'private' },
];
const DEFAULT_AVATAR = require('../../assets/images/home-brand-logo.png');

type EditableField = 'nickname';

const EDITOR_COPY: Record<
  EditableField,
  {
    keyboardType: KeyboardTypeOptions;
    label: string;
    maxLength: number;
    placeholder: string;
    title: string;
  }
> = {
  nickname: {
    keyboardType: 'default',
    label: '昵称',
    maxLength: 16,
    placeholder: '请输入昵称',
    title: '编辑昵称',
  },
};

type EditorState = {
  field: EditableField;
  value: string;
};

function genderLabel(value?: AccountGender | null) {
  return GENDER_OPTIONS.find((item) => item.value === value)?.label ?? '未设置';
}

function formatEmail(email?: string | null) {
  if (!email) return '未绑定';
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  if (name.length <= 2) return `${name.slice(0, 1)}***@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
}

function showMessage(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

export default function AccountSecurityScreen() {
  const router = useRouter();
  const insets = useLayoutInsets();
  const { user, updateAccountProfile } = useApp();
  const [genderSheetVisible, setGenderSheetVisible] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const nickname = user?.nickname || '出门体验官';
  const hasAvatar = Boolean(user?.avatarUri);
  const avatarSource = hasAvatar && user?.avatarUri ? { uri: user.avatarUri } : DEFAULT_AVATAR;

  function openEditor(field: EditableField) {
    setEditorError(null);
    setEditor({
      field,
      value: nickname,
    });
  }

  function closeEditor() {
    Keyboard.dismiss();
    setEditor(null);
    setEditorError(null);
  }

  async function handleSaveEditor() {
    if (!editor) return;

    const value = editor.value.trim();
    if (editor.field === 'nickname' && !value) {
      setEditorError('昵称不能为空');
      return;
    }

    setSaving(true);
    try {
      await updateAccountProfile({ [editor.field]: value });
      closeEditor();
    } catch (reason) {
      setEditorError(reason instanceof Error ? reason.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handlePickAvatar() {
    if (avatarSaving) return;
    if (!user) {
      showMessage('无法上传头像', '用户信息还没有准备好，请稍后再试。');
      return;
    }

    setAvatarSaving(true);
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          showMessage('无法访问相册', '请在系统设置中允许访问后再试。');
          return;
        }
      }

      const options = {
        allowsEditing: true,
        aspect: [1, 1],
        base64: true,
        mediaTypes: ['images'],
        quality: 0.82,
      } satisfies ImagePicker.ImagePickerOptions;
      const result = await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      if (!asset?.uri || !asset.base64) {
        throw new Error('未获取到图片内容，请重新选择。');
      }

      const uploaded = await uploadUserAvatar({
        userId: user.id,
        imageBase64: asset.base64,
        mimeType: asset.mimeType ?? 'image/jpeg',
        localUri: asset.uri,
      });
      await updateAccountProfile({ avatarUri: uploaded.avatarUri });
    } catch (reason) {
      showMessage('头像上传失败', reason instanceof Error ? reason.message : '请稍后重试。');
    } finally {
      setAvatarSaving(false);
    }
  }

  async function handleSelectGender(value: AccountGender) {
    await updateAccountProfile({ gender: value });
    setGenderSheetVisible(false);
  }

  const editorCopy = editor ? EDITOR_COPY[editor.field] : null;

  return (
    <AppShell>
      <ScrollView
        contentContainerStyle={[
          styles.page,
          {
            paddingBottom: insets.bottom + spacing['2xl'],
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <InnerPageHeader title="账号与安全" onBack={() => backOrReplace(router, '/profile')} />

        <View style={styles.groupCard}>
          <AccountRow
            label="头像"
            onPress={() => void handlePickAvatar()}
            right={
              <View style={styles.avatarWrap}>
                <Image
                  resizeMode={hasAvatar ? 'cover' : 'contain'}
                  source={avatarSource}
                  style={[styles.avatarImage, !hasAvatar && styles.avatarLogoImage]}
                />
              </View>
            }
          />
          <AccountRow label="昵称" value={nickname} onPress={() => openEditor('nickname')} />
          <AccountRow
            label="性别"
            value={genderLabel(user?.gender)}
            onPress={() => setGenderSheetVisible(true)}
          />
          <AccountRow
            isLast
            label="邮箱"
            value={formatEmail(user?.email)}
          />
        </View>
      </ScrollView>

      <BottomSheet
        onClose={() => setGenderSheetVisible(false)}
        title="选择性别"
        visible={genderSheetVisible}>
        <View style={styles.sheetList}>
          {GENDER_OPTIONS.map((option) => {
            const selected = option.value === user?.gender;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={option.value}
                onPress={() => void handleSelectGender(option.value)}
                style={({ pressed }) => [
                  styles.choiceRow,
                  selected && styles.choiceRowActive,
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.choiceText, selected && styles.choiceTextActive]}>
                  {option.label}
                </Text>
                {selected ? <AppIcon name="check" size={16} color={palette.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>

      <BottomSheet
        onClose={closeEditor}
        title={editorCopy?.title ?? ''}
        visible={Boolean(editor)}>
        {editor && editorCopy ? (
          <View style={styles.editor}>
            <Text style={styles.inputLabel}>{editorCopy.label}</Text>
            <TextInput
              autoFocus
              keyboardType={editorCopy.keyboardType}
              maxLength={editorCopy.maxLength}
              onChangeText={(value) => {
                setEditor((current) => (current ? { ...current, value } : current));
                setEditorError(null);
              }}
              placeholder={editorCopy.placeholder}
              placeholderTextColor={palette.placeholder}
              style={styles.input}
              value={editor.value}
            />
            {editorError ? <Text style={styles.errorText}>{editorError}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void handleSaveEditor()}
              style={({ pressed }) => [
                styles.saveButton,
                (pressed || saving) && styles.pressed,
              ]}>
              <Text style={styles.saveButtonText}>{saving ? '保存中' : '保存'}</Text>
            </Pressable>
          </View>
        ) : null}
      </BottomSheet>
    </AppShell>
  );
}

function AccountRow({
  isLast = false,
  label,
  onPress,
  right,
  value,
}: {
  isLast?: boolean;
  label: string;
  onPress?: () => void;
  right?: React.ReactNode;
  value?: string;
}) {
  const content = (
    <>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {right ?? <Text numberOfLines={1} style={styles.rowValue}>{value}</Text>}
        {onPress ? (
          <View style={styles.arrowIcon}>
            <AppIcon name="arrow-right" size={15} color={palette.placeholder} />
          </View>
        ) : null}
      </View>
    </>
  );

  if (!onPress) {
    return <View style={[styles.row, !isLast && styles.rowDivider]}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, !isLast && styles.rowDivider, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  groupCard: {
    overflow: 'hidden',
    borderRadius: radii['2xl'],
    backgroundColor: palette.surface,
    ...shadows.card,
  },
  row: {
    width: '100%',
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
    color: palette.ink,
    fontSize: typography.body,
    lineHeight: 20,
    fontWeight: '900',
  },
  rowRight: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  rowValue: {
    minWidth: 0,
    flexShrink: 1,
    maxWidth: '86%',
    color: palette.text,
    fontSize: typography.body,
    lineHeight: 20,
    fontWeight: '400',
  },
  arrowIcon: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: palette.primary,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarLogoImage: {
    width: '70%',
    height: '70%',
  },
  sheetList: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  choiceRow: {
    width: '100%',
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.paper,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    overflow: 'hidden',
  },
  choiceRowActive: {
    borderColor: palette.primaryLight,
    backgroundColor: palette.primarySoft,
  },
  choiceText: {
    flex: 1,
    minWidth: 0,
    color: palette.text,
    fontSize: typography.body,
    lineHeight: 20,
    fontWeight: '400',
  },
  choiceTextActive: {
    color: palette.primaryDark,
    fontWeight: '400',
  },
  editor: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  inputLabel: {
    color: palette.text,
    fontSize: typography.body,
    lineHeight: 20,
    fontWeight: '900',
  },
  input: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.paper,
    paddingHorizontal: spacing.lg,
    color: palette.ink,
    fontSize: typography.body,
    lineHeight: 20,
    fontWeight: '400',
  },
  errorText: {
    color: palette.error,
    fontSize: typography.body,
    lineHeight: 20,
    fontWeight: '800',
  },
  saveButton: {
    height: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    backgroundColor: palette.primary,
    ...shadows.primaryButton,
  },
  saveButtonText: {
    color: palette.white,
    fontSize: typography.body,
    lineHeight: 20,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
  },
});
