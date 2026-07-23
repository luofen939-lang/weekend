import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';

import {
  resolveApiMediaUrl,
  addTodo,
  createGuestSession,
  createOrContinueDraw,
  rerollDraw,
  getCurrentDraw,
  getCities,
  getPreferenceOptions,
  checkinToday,
  getProfileProgress,
  getWeekCheckins,
  isUnauthorizedApiError,
  loginAccount,
  logoutAccount,
  registerAccount,
  tryRestoreSession,
  updateUserProfile,
} from '@/services/api';
import type {
  AuthSession,
  WeekCheckinSummary,
  ProfileProgress,
  City,
  DrawResult,
  GuestUser,
  LoginInput,
  PreferenceOptions,
  Preferences,
  RegisterInput,
} from '@/types';

const DEVICE_KEY = '@lazyde/device-id';
const ACCOUNT_PROFILE_KEY_PREFIX = '@lazyde/account-profile:';
const CURRENT_DRAW_KEY_PREFIX = '@lazyde/current-draw:';
const CURRENT_DRAW_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

type LastDrawInput = {
  cityId: number;
  preferences: Preferences;
};

type StoredDrawState = {
  userId: number;
  savedAt: number;
  result: DrawResult;
  input: LastDrawInput;
};

type AccountProfilePatch = Partial<Pick<GuestUser, 'avatarUri' | 'email' | 'gender' | 'nickname' | 'phone'>>;

type CheckinResponse = WeekCheckinSummary & { alreadySigned: boolean };

type AppContextValue = {
  user: GuestUser | null;
  cities: City[];
  options: PreferenceOptions | null;
  selectedCityId: number | null;
  currentDraw: DrawResult | null;
  isBooting: boolean;
  error: string | null;
  checkinSummary: WeekCheckinSummary | null;
  profileProgress: ProfileProgress | null;
  isRegistered: boolean;
  setSelectedCityId: (cityId: number) => void;
  startDraw: (cityId: number, preferences: Preferences) => Promise<void>;
  reroll: () => Promise<void>;
  addCurrentDrawToTodos: (scheduledDate?: string) => Promise<void>;
  login: (input: Omit<LoginInput, 'deviceId'>) => Promise<AuthSession>;
  register: (input: Omit<RegisterInput, 'deviceId'>) => Promise<AuthSession>;
  updateAccountProfile: (patch: AccountProfilePatch) => Promise<void>;
  logout: () => Promise<void>;
  checkinToday: () => Promise<CheckinResponse>;
  refreshCheckins: () => Promise<void>;
  refreshProfileProgress: () => Promise<void>;
  refreshCurrentUser: () => Promise<GuestUser | null>;
  clearError: () => void;
  retry: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

function createDeviceId() {
  return `lazyde-${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

async function getOrCreateDeviceId() {
  const existing = await AsyncStorage.getItem(DEVICE_KEY);
  if (existing) {
    return existing;
  }

  const created = createDeviceId();
  await AsyncStorage.setItem(DEVICE_KEY, created);
  return created;
}

function getAccountProfileKey(userId: number) {
  return `${ACCOUNT_PROFILE_KEY_PREFIX}${userId}`;
}

function getCurrentDrawKey(userId: number) {
  return `${CURRENT_DRAW_KEY_PREFIX}${userId}`;
}

function isStoredGender(value: unknown): value is GuestUser['gender'] {
  return value === 'male' || value === 'female' || value === 'private' || value === null;
}

function normalizeGuestAvatarUri(user: GuestUser) {
  return user.avatarUri ? { ...user, avatarUri: resolveApiMediaUrl(user.avatarUri) } : user;
}

function normalizeCurrentDrawCover(result: DrawResult) {
  return {
    ...result,
    activity: {
      ...result.activity,
      coverImageUri: resolveApiMediaUrl(result.activity.coverImageUri),
    },
  };
}

function mergeAccountProfile(user: GuestUser, profile: AccountProfilePatch): GuestUser {
  const safeAvatarUri =
    typeof profile.avatarUri === 'string' && !profile.avatarUri.startsWith('blob:')
      ? resolveApiMediaUrl(profile.avatarUri)
      : undefined;
  return {
    ...user,
    ...(safeAvatarUri || profile.avatarUri === null
      ? { avatarUri: safeAvatarUri ?? profile.avatarUri }
      : {}),
    ...(isStoredGender(profile.gender) ? { gender: profile.gender } : {}),
    ...(typeof profile.nickname === 'string' ? { nickname: profile.nickname } : {}),
    ...(typeof profile.phone === 'string' || profile.phone === null ? { phone: profile.phone } : {}),
    ...(typeof profile.email === 'string' || profile.email === null ? { email: profile.email } : {}),
  };
}

async function readStoredAccountProfile(userId: number): Promise<AccountProfilePatch> {
  const raw = await AsyncStorage.getItem(getAccountProfileKey(userId));
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as AccountProfilePatch;
    return {
      ...(typeof parsed.avatarUri === 'string' || parsed.avatarUri === null
        ? { avatarUri: parsed.avatarUri }
        : {}),
      ...(isStoredGender(parsed.gender) ? { gender: parsed.gender } : {}),
      ...(typeof parsed.nickname === 'string' ? { nickname: parsed.nickname } : {}),
      ...(typeof parsed.phone === 'string' || parsed.phone === null ? { phone: parsed.phone } : {}),
      ...(typeof parsed.email === 'string' || parsed.email === null ? { email: parsed.email } : {}),
    };
  } catch {
    return {};
  }
}

async function writeStoredAccountProfile(userId: number, profile: AccountProfilePatch) {
  const safeProfile = {
    ...(typeof profile.avatarUri === 'string' || profile.avatarUri === null
      ? { avatarUri: profile.avatarUri }
      : {}),
    ...(isStoredGender(profile.gender) ? { gender: profile.gender } : {}),
    ...(typeof profile.nickname === 'string' ? { nickname: profile.nickname } : {}),
    ...(typeof profile.phone === 'string' || profile.phone === null ? { phone: profile.phone } : {}),
    ...(typeof profile.email === 'string' || profile.email === null ? { email: profile.email } : {}),
  };

  if (Object.keys(safeProfile).length === 0) {
    await AsyncStorage.removeItem(getAccountProfileKey(userId));
    return;
  }

  await AsyncStorage.setItem(getAccountProfileKey(userId), JSON.stringify(safeProfile));
}

function isDrawResult(value: unknown): value is DrawResult {
  if (typeof value !== 'object' || value === null) return false;

  const input = value as DrawResult & { attemptsUsed?: unknown; attemptsRemaining?: unknown; activity?: unknown };
  return (
    typeof input.drawSessionId === 'string' &&
    uuidPattern.test(input.drawSessionId) &&
    typeof input.attemptsUsed === 'number' &&
    Number.isFinite(input.attemptsUsed) &&
    typeof input.attemptsRemaining === 'number' &&
    Number.isFinite(input.attemptsRemaining) &&
    typeof input.activity === 'object' &&
    input.activity !== null
  );
}

async function readStoredCurrentDraw(userId: number) {
  const raw = await AsyncStorage.getItem(getCurrentDrawKey(userId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredDrawState;
    const isExpired = Date.now() - Number(parsed.savedAt) > CURRENT_DRAW_TTL_MS;
    if (!parsed || parsed.userId !== userId || isExpired || !isDrawResult(parsed.result)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function writeStoredCurrentDraw(userId: number, result: DrawResult, input: LastDrawInput) {
  const payload: StoredDrawState = {
    userId,
    savedAt: Date.now(),
    result,
    input,
  };

  await AsyncStorage.setItem(getCurrentDrawKey(userId), JSON.stringify(payload));
}

async function clearStoredCurrentDraw(userId: number) {
  await AsyncStorage.removeItem(getCurrentDrawKey(userId));
}

async function withStoredAccountProfile(user: GuestUser) {
  let profile = await readStoredAccountProfile(user.id);
  let syncedProfile: AccountProfilePatch = {};

  if (
    user.authType === 'registered' &&
    typeof profile.nickname === 'string' &&
    profile.nickname !== user.nickname
  ) {
    try {
      const result = await updateUserProfile({ nickname: profile.nickname });
      if (result.persisted) {
        syncedProfile = result.profile;
        profile = { ...profile };
        delete profile.nickname;
        await writeStoredAccountProfile(user.id, profile);
      }
    } catch {
      // Keep the local nickname as a pending profile change if remote sync fails.
    }
  }

  return normalizeGuestAvatarUri(mergeAccountProfile(user, { ...profile, ...syncedProfile }));
}

export function AppProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<GuestUser | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [options, setOptions] = useState<PreferenceOptions | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
  const [currentDraw, setCurrentDraw] = useState<DrawResult | null>(null);
  const [lastDrawInput, setLastDrawInput] = useState<LastDrawInput | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkinSummary, setCheckinSummary] = useState<WeekCheckinSummary | null>(null);
  const [profileProgress, setProfileProgress] = useState<ProfileProgress | null>(null);

  const syncCheckinForUser = useCallback(async (targetUser: GuestUser) => {
    if (targetUser.authType !== 'registered') {
      setCheckinSummary(null);
      return null;
    }

    setError(null);
    try {
      const result = await checkinToday();
      setCheckinSummary(result);
      return result;
    } catch (reason) {
      if (isUnauthorizedApiError(reason)) {
        await logoutAccount();
        setUser((current) => (current?.id === targetUser.id ? null : current));
        setCheckinSummary(null);
        setProfileProgress(null);
        setCurrentDraw(null);
        setLastDrawInput(null);
        return null;
      }

      const message = reason instanceof Error ? reason.message : '签到失败，请稍后重试';
      setError(message);
      throw reason;
    }
  }, []);

  const syncProfileProgress = useCallback(async (targetUser: GuestUser) => {
    if (targetUser.authType !== 'registered') {
      setProfileProgress(null);
      return null;
    }

    setError(null);
    try {
      const result = await getProfileProgress();
      setProfileProgress(result);
      return result;
    } catch (reason) {
      if (isUnauthorizedApiError(reason)) {
        await logoutAccount();
        setUser((current) => (current?.id === targetUser.id ? null : current));
        setCheckinSummary(null);
        setProfileProgress(null);
        setCurrentDraw(null);
        setLastDrawInput(null);
        return null;
      }

      const message = reason instanceof Error ? reason.message : '成长数据刷新失败，请稍后重试';
      setError(message);
      throw reason;
    }
  }, []);

  const bootstrap = useCallback(async () => {
    setIsBooting(true);
    setError(null);
    try {
      const deviceId = await getOrCreateDeviceId();
      const [cityData, optionData] = await Promise.all([
        getCities(),
        getPreferenceOptions(),
      ]);

      let userData: GuestUser;
      const restoredUser = await tryRestoreSession();
      if (restoredUser) {
        userData = restoredUser;
      } else {
        userData = await createGuestSession(deviceId);
      }

      setCities(cityData);
      setOptions(optionData);
      const normalizedUser = await withStoredAccountProfile(normalizeGuestAvatarUri(userData));
      setUser(normalizedUser);

      const snapshot = await readStoredCurrentDraw(normalizedUser.id);
      if (snapshot) {
        setCurrentDraw(normalizeCurrentDrawCover(snapshot.result));
        setLastDrawInput(snapshot.input);
      } else if (normalizedUser.authType === 'registered') {
        try {
          const remote = await getCurrentDraw();
          if (remote?.draw && remote.input) {
            setCurrentDraw(remote.draw);
            setLastDrawInput(remote.input);
            await writeStoredCurrentDraw(normalizedUser.id, remote.draw, remote.input);
          }
        } catch (reason) {
          console.error('恢复盲盒会话失败', reason);
        }
      }

      setSelectedCityId((current) => current ?? cityData[0]?.id ?? null);
      void syncCheckinForUser(normalizedUser).catch(() => undefined);
      void syncProfileProgress(normalizedUser).catch(() => undefined);
    } catch (reason) {
      console.error('应用初始化失败', reason);
      setError(reason instanceof Error ? reason.message : '应用初始化失败');
    } finally {
      setIsBooting(false);
    }
  }, [syncCheckinForUser, syncProfileProgress]);

  useEffect(() => {
    queueMicrotask(() => {
      void bootstrap();
    });
  }, [bootstrap]);

  const doCheckinToday = useCallback(async () => {
    if (user?.authType !== 'registered' || !user) {
      throw new Error('请先登录');
    }

    const result = await syncCheckinForUser(user);
    if (!result) {
      throw new Error('签到失败，请稍后重试');
    }

    await syncProfileProgress(user);

    return result;
  }, [syncCheckinForUser, syncProfileProgress, user]);

  const refreshCheckins = useCallback(async () => {
    if (user?.authType !== 'registered') {
      setCheckinSummary(null);
      return;
    }

    setError(null);
    try {
      setCheckinSummary(await getWeekCheckins());
    } catch (reason) {
      if (isUnauthorizedApiError(reason)) {
        await logoutAccount();
        setUser(null);
        setCheckinSummary(null);
        setProfileProgress(null);
        return;
      }

      console.error('刷新签到失败', reason);
      const message = reason instanceof Error ? reason.message : '刷新签到失败';
      setError(message);
      throw reason;
    }
  }, [user?.authType]);


  const startDraw = useCallback(
    async (cityId: number, preferences: Preferences) => {
      if (!user) {
        throw new Error('匿名会话还没有准备好');
      }

      setError(null);
      try {
        const result = await createOrContinueDraw({
          userId: user.id,
          cityId,
          preferences,
        });
        setCurrentDraw(result);
        setLastDrawInput({ cityId, preferences });
        await writeStoredCurrentDraw(user.id, result, { cityId, preferences });
      } catch (reason) {
        console.error('盲盒抽取失败', reason);
        setError(reason instanceof Error ? reason.message : '盲盒抽取失败');
        throw reason;
      }
    },
    [user],
  );

  const reroll = useCallback(async () => {
    if (!user || !currentDraw || !lastDrawInput) {
      throw new Error('没有可以继续的抽取会话');
    }

    setError(null);
    try {
      const result = await rerollDraw({
        userId: user.id,
        cityId: lastDrawInput.cityId,
        preferences: lastDrawInput.preferences,
        drawSessionId: currentDraw.drawSessionId,
      });
      setCurrentDraw(result);
      await writeStoredCurrentDraw(user.id, result, lastDrawInput);
      } catch (reason) {
      console.error('重新抽取失败', reason);
      setError(reason instanceof Error ? reason.message : '重新抽取失败');
      throw reason;
    }
  }, [currentDraw, lastDrawInput, user]);

  const addCurrentDrawToTodos = useCallback(async (scheduledDate?: string) => {
    if (!user || !currentDraw) {
      throw new Error('还没有确认的玩法');
    }

    await addTodo({
      userId: user.id,
      activityId: currentDraw.activity.id,
      drawSessionId: currentDraw.drawSessionId,
      ...(scheduledDate ? { scheduledDate } : {}),
    });
  }, [currentDraw, user]);

  const login = useCallback(async (input: Omit<LoginInput, 'deviceId'>) => {
    setError(null);
    try {
      const deviceId = await getOrCreateDeviceId();
      const session = await loginAccount({ ...input, deviceId });
      const userWithProfile = await withStoredAccountProfile(session.user);
      setUser(userWithProfile);
      void syncCheckinForUser(userWithProfile).catch(() => undefined);
      void syncProfileProgress(userWithProfile).catch(() => undefined);
      return { ...session, user: userWithProfile };
    } catch (reason) {
      console.error('登录失败', reason);
      const message = reason instanceof Error ? reason.message : '登录失败';
      setError(message);
      throw reason;
    }
  }, [syncCheckinForUser, syncProfileProgress]);

  const register = useCallback(async (input: Omit<RegisterInput, 'deviceId'>) => {
    setError(null);
    try {
      const deviceId = await getOrCreateDeviceId();
      const session = await registerAccount({ ...input, deviceId });
      const userWithProfile = await withStoredAccountProfile(session.user);
      setUser(userWithProfile);
      void syncCheckinForUser(userWithProfile).catch(() => undefined);
      void syncProfileProgress(userWithProfile).catch(() => undefined);
      return { ...session, user: userWithProfile };
    } catch (reason) {
      console.error('注册失败', reason);
      const message = reason instanceof Error ? reason.message : '注册失败';
      setError(message);
      throw reason;
    }
  }, [syncCheckinForUser, syncProfileProgress]);

  const refreshCurrentUser = useCallback(async () => {
    const restoredUser = await tryRestoreSession();
    if (!restoredUser) {
      return null;
    }

    const userWithProfile = await withStoredAccountProfile(restoredUser);
    setUser(userWithProfile);
    return userWithProfile;
  }, []);

  const updateAccountProfile = useCallback(
    async (patch: AccountProfilePatch) => {
      if (!user) return;

      const storedProfile = await readStoredAccountProfile(user.id);
      let nextPatch = patch;
      const persistedFields: (keyof AccountProfilePatch)[] = [];

      if (user.authType === 'registered' && typeof patch.nickname === 'string') {
        const result = await updateUserProfile({ nickname: patch.nickname });
        nextPatch = { ...nextPatch, ...result.profile };
        if (result.persisted) {
          persistedFields.push('nickname');
        }
      }

      const nextProfile = { ...storedProfile, ...nextPatch };
      persistedFields.forEach((field) => {
        delete nextProfile[field];
      });

      await writeStoredAccountProfile(user.id, nextProfile);
      setUser((current) => (current?.id === user.id ? mergeAccountProfile(current, nextPatch) : current));
    },
    [user],
  );

  const logout = useCallback(async () => {
    setError(null);
    try {
      const currentUserId = user?.id;
      await logoutAccount();
      setUser(null);
      setCurrentDraw(null);
      setLastDrawInput(null);
      setCheckinSummary(null);
      setProfileProgress(null);
      if (currentUserId !== undefined) {
        await clearStoredCurrentDraw(currentUserId);
      }
    } catch (reason) {
      console.error('退出登录失败', reason);
      setError(reason instanceof Error ? reason.message : '退出登录失败');
      throw reason;
    }
  }, [user]);

  const refreshProfileProgress = useCallback(async () => {
    if (!user) {
      setProfileProgress(null);
      return;
    }

    await syncProfileProgress(user);
  }, [syncProfileProgress, user]);

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      cities,
      options,
      selectedCityId,
      currentDraw,
      isBooting,
      error,
      checkinSummary,
      profileProgress,
      doCheckinToday,
      refreshProfileProgress,
      refreshCurrentUser,
      isRegistered: user?.authType === 'registered',
      setSelectedCityId,
      startDraw,
      reroll,
      addCurrentDrawToTodos,
      login,
      register,
      updateAccountProfile,
      logout,
      checkinToday: doCheckinToday,
      refreshCheckins,
      clearError: () => setError(null),
      retry: bootstrap,
    }),
    [
      addCurrentDrawToTodos,
      bootstrap,
      cities,
      currentDraw,
      error,
      doCheckinToday,
      checkinSummary,
      profileProgress,
      isBooting,
      login,
      logout,
      options,
      refreshCheckins,
      register,
      reroll,
      refreshCurrentUser,
      refreshProfileProgress,
      selectedCityId,
      startDraw,
      updateAccountProfile,
      user,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp 必须在 AppProvider 内使用');
  }
  return context;
}
