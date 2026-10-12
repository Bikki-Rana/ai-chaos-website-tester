import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import * as api from '../services/api';
import type { AuthUser } from '../services/api';
import { UNAUTHORIZED_EVENT, clearToken, getToken, setToken } from '../services/token';
import SignInRequired from '../components/SignInRequired';
import { SkeletonRows } from '../components/States';

type Status = 'loading' | 'authed' | 'anon';

interface AuthContextValue {
  status: Status;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<Status>(() => (getToken() ? 'loading' : 'anon'));

  // Restore the session from a stored token.
  useEffect(() => {
    if (!getToken()) return;
    let alive = true;
    api.getMe().then(
      (u) => {
        if (!alive) return;
        setUser(u);
        setStatus('authed');
      },
      () => {
        if (!alive) return;
        setUser(null);
        setStatus('anon');
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  // Any API call that returns 401 ends the session.
  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setStatus('anon');
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    setToken(res.access_token);
    setUser(res.user);
    setStatus('authed');
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const res = await api.signup(email, password);
    setToken(res.access_token);
    setUser(res.user);
    setStatus('authed');
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    setUser(null);
    setStatus('anon');
  }, []);

  const value = useMemo(
    () => ({ status, user, signIn, signUp, signOut }),
    [status, user, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Wraps pages that need an account. Guests see the "Sign in to run tests" page instead. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="ct-page">
        <SkeletonRows rows={4} />
      </div>
    );
  }
  if (status === 'anon') {
    return <SignInRequired from={location.pathname + location.search} />;
  }
  return <>{children}</>;
}