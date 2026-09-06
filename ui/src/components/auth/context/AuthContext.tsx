import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { IS_PLATFORM, IS_SAAS_MODE } from '../../../constants/config';
import { hydrateDesignCanvasFromServerPreferences } from '../../../shared/designCanvasGateSync';
import { api } from '../../../utils/api';
import { AUTH_ERROR_MESSAGES, AUTH_TOKEN_STORAGE_KEY } from '../constants';
import type {
 AuthContextValue,
 AuthProviderProps,
 AuthSessionPayload,
 AuthStatusPayload,
 AuthUser,
 AuthUserPayload,
 OnboardingStatusPayload,
} from '../types';
import { parseJsonSafely, resolveApiErrorMessage } from '../utils';
import { clearStorageReconcileSessionFlags } from '../../../saas/storage/postLoginReconcile';

const AuthContext = createContext<AuthContextValue | null>(null);

const readStoredToken = (): string | null => localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

const persistToken = (token: string) => {
 localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
};

const clearStoredToken = () => {
 localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
};

export function useAuth(): AuthContextValue {
 const context = useContext(AuthContext);
 if (!context) {
 throw new Error('useAuth must be used within an AuthProvider');
 }

 return context;
}

export function AuthProvider({ children }: AuthProviderProps) {
 const [user, setUser] = useState<AuthUser | null>(null);
 const [token, setToken] = useState<string | null>(() => readStoredToken());
 const [isLoading, setIsLoading] = useState(true);
 const [needsSetup, setNeedsSetup] = useState(false);
 const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true);
 const [error, setError] = useState<string | null>(null);

 const setSession = useCallback((nextUser: AuthUser, nextToken: string) => {
 setUser(nextUser);
 setToken(nextToken);
 persistToken(nextToken);
 }, []);

 const clearSession = useCallback(() => {
 setUser(null);
 setToken(null);
 clearStoredToken();
 }, []);

 const checkOnboardingStatus = useCallback(async () => {
 const timeoutMs = 12_000;
 try {
 const response = await Promise.race([
 api.user.onboardingStatus(),
 new Promise<Response>((_, reject) => {
 window.setTimeout(() => reject(new Error('onboarding_status_timeout')), timeoutMs);
 }),
 ]);
 if (!response.ok) {
 return;
 }

 const payload = await parseJsonSafely<OnboardingStatusPayload>(response);
 setHasCompletedOnboarding(Boolean(payload?.hasCompletedOnboarding));
 } catch (caughtError) {
 console.error('Error checking onboarding status:', caughtError);
 // Fail open to avoid blocking access on transient onboarding status errors.
 setHasCompletedOnboarding(true);
 }
 }, []);

 const refreshOnboardingStatus = useCallback(async () => {
 await checkOnboardingStatus();
 }, [checkOnboardingStatus]);

 const checkAuthStatus = useCallback(async () => {
 const authTimeoutMs = 15_000;
 try {
 setIsLoading(true);
 setError(null);

 const statusResponse = await Promise.race([
 api.auth.status(),
 new Promise<Response>((_, reject) => {
 window.setTimeout(() => reject(new Error('auth_status_timeout')), authTimeoutMs);
 }),
 ]);
 const statusPayload = await parseJsonSafely<AuthStatusPayload>(statusResponse);

 // PD-SAAS-FORK: SaaS never uses the fake local user shortcut.
 if (statusPayload?.authDisabled && !IS_SAAS_MODE) {
 setUser({ username: 'local' });
 setNeedsSetup(false);
 await checkOnboardingStatus();
 return;
 }

 if (statusPayload?.needsSetup) {
 setNeedsSetup(true);
 return;
 }

 setNeedsSetup(false);

 if (!token) {
 return;
 }

 const userResponse = await api.auth.user();
 if (!userResponse.ok) {
 clearSession();
 return;
 }

 const userPayload = await parseJsonSafely<AuthUserPayload>(userResponse);
 if (!userPayload?.user) {
 clearSession();
 return;
 }

 setUser(userPayload.user);
 await checkOnboardingStatus();
 if (IS_SAAS_MODE) {
   void hydrateDesignCanvasFromServerPreferences();
 }
 } catch (caughtError) {
 console.error('[Auth] Auth status check failed:', caughtError);
 setError(AUTH_ERROR_MESSAGES.authStatusCheckFailed);
 } finally {
 setIsLoading(false);
 }
 }, [checkOnboardingStatus, clearSession, token]);

 useEffect(() => {
 if (IS_PLATFORM && !IS_SAAS_MODE) {
 setUser({ username: 'platform-user' });
 setNeedsSetup(false);
 const watchdog = window.setTimeout(() => {
 setIsLoading(false);
 }, 15_000);
 void checkOnboardingStatus().finally(() => {
 window.clearTimeout(watchdog);
 setIsLoading(false);
 });
 return;
 }

 void checkAuthStatus();
 }, [checkAuthStatus, checkOnboardingStatus]);

 const login = useCallback<AuthContextValue['login']>(
 async (username, password) => {
 try {
 setError(null);
 const response = await api.auth.login(username, password);
 const payload = await parseJsonSafely<AuthSessionPayload>(response);

 if (!response.ok || !payload?.token || !payload.user) {
 const message = resolveApiErrorMessage(payload, AUTH_ERROR_MESSAGES.loginFailed);
 setError(message);
 return { success: false, error: message };
 }

 setSession(payload.user, payload.token);
 setNeedsSetup(false);
 await checkOnboardingStatus();
 if (IS_SAAS_MODE) {
   void hydrateDesignCanvasFromServerPreferences();
 }
 return { success: true };
 } catch (caughtError) {
 console.error('Login error:', caughtError);
 setError(AUTH_ERROR_MESSAGES.networkError);
 return { success: false, error: AUTH_ERROR_MESSAGES.networkError };
 }
 },
 [checkOnboardingStatus, setSession],
 );

 const register = useCallback<AuthContextValue['register']>(
 async (username, password) => {
 try {
 setError(null);
 const response = await api.auth.register(username, password);
 const payload = await parseJsonSafely<AuthSessionPayload>(response);

 if (!response.ok || !payload?.token || !payload.user) {
 const message = resolveApiErrorMessage(payload, AUTH_ERROR_MESSAGES.registrationFailed);
 setError(message);
 return { success: false, error: message };
 }

 setSession(payload.user, payload.token);
 setNeedsSetup(false);
 await checkOnboardingStatus();
 if (IS_SAAS_MODE) {
   void hydrateDesignCanvasFromServerPreferences();
 }
 return { success: true };
 } catch (caughtError) {
 console.error('Registration error:', caughtError);
 setError(AUTH_ERROR_MESSAGES.networkError);
 return { success: false, error: AUTH_ERROR_MESSAGES.networkError };
 }
 },
 [checkOnboardingStatus, setSession],
 );

 const logout = useCallback(() => {
  const tokenToInvalidate = token;
  clearStorageReconcileSessionFlags();
  clearSession();

  if (tokenToInvalidate) {
   void api.auth.logout().catch((caughtError: unknown) => {
    console.error('Logout endpoint error:', caughtError);
   });
  }
 }, [clearSession, token]);

 const refreshUser = useCallback(async () => {
  if (!token) return;
  try {
   const userResponse = await api.auth.user();
   if (!userResponse.ok) return;
   const userPayload = await parseJsonSafely<AuthUserPayload>(userResponse);
   if (userPayload?.user) {
    setUser(userPayload.user);
   }
  } catch (caughtError) {
   console.error('[Auth] refresh user failed:', caughtError);
  }
 }, [token]);

 const contextValue = useMemo<AuthContextValue>(
  () => ({
   user,
   token,
   isLoading,
   needsSetup,
   hasCompletedOnboarding,
   error,
   login,
   register,
   logout,
   refreshUser,
   refreshOnboardingStatus,
  }),
  [
   error,
   hasCompletedOnboarding,
   isLoading,
   login,
   logout,
   needsSetup,
   refreshOnboardingStatus,
   refreshUser,
   register,
 token,
 user,
 ],
 );

 return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
