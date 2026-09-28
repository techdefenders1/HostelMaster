import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, ApiError } from '../api/client';
import { User, AuthStatus } from '../types';

export type AuthMode = 'loading' | 'auth' | 'login_step2' | 'authenticated';

export interface Setup2FAData {
  setupToken: string;
  qrCodeUrl: string;
  manualKey: string;
  recoveryCodes: string[];
}

interface AuthContextType {
  initialized: boolean;
  mode: AuthMode;
  user: User | null;
  twoFactorEnabled: boolean;
  challengeToken: string | null;
  error: string | null;
  successMessage: string | null;
  isLoading: boolean;
  register: (username: string, password: string, confirmPassword: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  loginStep2: (totpCode: string) => Promise<void>;
  cancelStep2: () => void;
  logout: () => Promise<void>;
  clearMessages: () => void;
  checkAuthStatus: () => Promise<void>;
  enable2FAInit: () => Promise<Setup2FAData>;
  enable2FAConfirm: (setupToken: string, totpCode: string) => Promise<void>;
  disable2FA: (currentPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [initialized, setInitialized] = useState<boolean>(true);
  const [mode, setMode] = useState<AuthMode>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const clearMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<AuthStatus>('/auth/status');
      setInitialized(res.initialized !== false);

      if (res.authenticated && res.user) {
        setUser(res.user);
        setTwoFactorEnabled(!!res.twoFactorEnabled);
        setMode('authenticated');
      } else {
        setUser(null);
        setMode('auth');
      }
    } catch (err: any) {
      console.error('Failed to check auth status:', err);
      setUser(null);
      setMode('auth');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Register new account (No 2FA required on registration!)
  const register = async (username: string, password: string, confirmPassword: string) => {
    clearMessages();
    setIsLoading(true);
    try {
      const res = await api.post<any>('/auth/register', { username, password, confirmPassword });
      if (res.token) {
        localStorage.setItem('hostel_token', res.token);
      }
      setUser(res.user);
      setTwoFactorEnabled(false);
      setSuccessMessage('Account created successfully! Welcome to HostelMaster.');
      setMode('authenticated');
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : 'Failed to create account.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Login: Step 1 (Username & Password)
  const login = async (username: string, password: string) => {
    clearMessages();
    setIsLoading(true);
    try {
      const res = await api.post<any>('/auth/login-step1', { username, password });

      if (res.requires2FA) {
        // 2FA is ENABLED: transition to Step 2 (Google Authenticator)
        setChallengeToken(res.challengeToken);
        setTwoFactorEnabled(true);
        setSuccessMessage('Credentials verified. Please enter your 6-digit Google Authenticator code.');
        setMode('login_step2');
      } else {
        // 2FA is OFF: direct successful login!
        if (res.token) {
          localStorage.setItem('hostel_token', res.token);
        }
        setUser(res.user);
        setTwoFactorEnabled(false);
        setSuccessMessage('Logged in successfully!');
        setMode('authenticated');
      }
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : 'Login failed. Please check your credentials.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Login: Step 2 (Google Authenticator TOTP or recovery code)
  const loginStep2 = async (totpCode: string) => {
    if (!challengeToken) {
      setError('Login session expired. Please start over.');
      setMode('auth');
      return;
    }
    clearMessages();
    setIsLoading(true);
    try {
      const res = await api.post<any>('/auth/login-step2', {
        challengeToken,
        totpCode,
      });
      if (res.token) {
        localStorage.setItem('hostel_token', res.token);
      }
      setUser(res.user);
      setTwoFactorEnabled(true);
      setChallengeToken(null);
      setMode('authenticated');
      setSuccessMessage('Successfully authenticated with Google Authenticator!');
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : 'Invalid authenticator code.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const cancelStep2 = () => {
    setChallengeToken(null);
    clearMessages();
    setMode('auth');
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('hostel_token');
      setUser(null);
      setTwoFactorEnabled(false);
      setChallengeToken(null);
      clearMessages();
      setMode('auth');
    }
  };

  // Initiate 2FA setup inside Settings (generates QR code)
  const enable2FAInit = async (): Promise<Setup2FAData> => {
    clearMessages();
    try {
      const res = await api.post<Setup2FAData>('/auth/enable-2fa-init', {});
      return res;
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : 'Failed to generate 2FA QR code.';
      setError(msg);
      throw err;
    }
  };

  // Confirm and activate 2FA with 6-digit TOTP code
  const enable2FAConfirm = async (setupToken: string, totpCode: string) => {
    clearMessages();
    try {
      const res = await api.post<any>('/auth/enable-2fa-confirm', { setupToken, totpCode });
      setTwoFactorEnabled(true);
      setSuccessMessage(res.message || 'Two-Factor Authentication is now enabled!');
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : 'Verification failed.';
      setError(msg);
      throw err;
    }
  };

  // Disable 2FA inside Settings
  const disable2FA = async (currentPassword: string) => {
    clearMessages();
    try {
      const res = await api.post<any>('/auth/disable-2fa', { currentPassword });
      setTwoFactorEnabled(false);
      setSuccessMessage(res.message || 'Two-Factor Authentication has been disabled.');
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : 'Failed to disable 2FA.';
      setError(msg);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        initialized,
        mode,
        user,
        twoFactorEnabled,
        challengeToken,
        error,
        successMessage,
        isLoading,
        register,
        login,
        loginStep2,
        cancelStep2,
        logout,
        clearMessages,
        checkAuthStatus,
        enable2FAInit,
        enable2FAConfirm,
        disable2FA,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
