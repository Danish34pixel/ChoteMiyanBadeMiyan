import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { apiRequest } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const login = useCallback(async (credentials) => {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: credentials,
    });
    const { user, ...tokens } = response.data;

    setSession({
      user,
      ...tokens,
      expiresAt: Date.now() + tokens.expiresIn * 1000,
    });
    sessionRef.current = {
      user,
      ...tokens,
      expiresAt: Date.now() + tokens.expiresIn * 1000,
    };
    return user;
  }, []);

  const adminLogin = useCallback(async (credentials) => {
    const response = await apiRequest('/auth/admin/login', {
      method: 'POST',
      body: credentials,
    });
    const { user, ...tokens } = response.data;
    if (user.role !== 'admin') {
      throw new Error('This account does not have administrator access.');
    }

    const nextSession = {
      user,
      ...tokens,
      expiresAt: Date.now() + tokens.expiresIn * 1000,
    };
    sessionRef.current = nextSession;
    setSession(nextSession);
    return user;
  }, []);

  const adminRequest = useCallback(
    async (path, options = {}) => {
      const currentSession = sessionRef.current;
      if (currentSession?.user?.role !== 'admin') {
        throw new Error('An authorized admin session is required.');
      }

      try {
        return await apiRequest(path, {
          ...options,
          token: currentSession.accessToken,
        });
      } catch (error) {
        if (error.status !== 401) throw error;
      }

      try {
        const refreshed = await apiRequest('/auth/token/refresh', {
          method: 'POST',
          body: { refreshToken: currentSession.refreshToken },
        });
        const nextSession = {
          ...currentSession,
          ...refreshed.data,
          expiresAt: Date.now() + refreshed.data.expiresIn * 1000,
        };
        sessionRef.current = nextSession;
        setSession(nextSession);
        return await apiRequest(path, {
          ...options,
          token: nextSession.accessToken,
        });
      } catch (error) {
        sessionRef.current = null;
        setSession(null);
        throw error;
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    if (!session) return;

    try {
      let accessToken = session.accessToken;
      if (Date.now() >= session.expiresAt - 30_000) {
        const response = await apiRequest('/auth/token/refresh', {
          method: 'POST',
          body: { refreshToken: session.refreshToken },
        });
        accessToken = response.data.accessToken;
      }

      await apiRequest('/auth/logout', {
        method: 'POST',
        token: accessToken,
      });
    } finally {
      sessionRef.current = null;
      setSession(null);
    }
  }, [session]);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      login,
      adminLogin,
      logout,
      adminRequest,
    }),
    [session, login, adminLogin, logout, adminRequest],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
