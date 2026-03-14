import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetcher, FetcherError } from '@/lib/fetcher';

export type AuthMethod = 'password' | 'phone' | 'google' | 'refresh';

export type User = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  phone: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  role: string;
  image: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Session = {
  userId: string;
  role: string;
  authMethod: AuthMethod;
};

export type UserContextValue = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refetch: () => void;
};

export type SessionContextValue = {
  session: Session | null;
  isLoading: boolean;
  /** True when access token was issued via direct login (password/google), not refresh */
  isFreshJwt: boolean;
  refetch: () => void;
};

type AuthContextValue = {
  isUserLoading: boolean;
  user: User | null;
  isSessionLoading: boolean;
  session: Session | null;
  refetchUser: () => void;
  refetchSession: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const ME_QUERY_KEY = ['me'] as const;
export const SESSION_QUERY_KEY = ['auth', 'session'] as const;

async function fetchMe(): Promise<User | null> {
  try {
    const { data } = await fetcher<User>('/api/me');
    return data;
  } catch (e) {
    if (e instanceof FetcherError && e.status === 401) return null;
    throw e;
  }
}

async function fetchSession(): Promise<Session | null> {
  try {
    const { data } = await fetcher<Session>('/api/auth/session');
    return data;
  } catch (e) {
    if (e instanceof FetcherError && e.status === 401) return null;
    throw e;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: fetchMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSession,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const refetchUser = useMemo(
    () => () => void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY }),
    [queryClient],
  );
  const refetchSession = useMemo(
    () => () => void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }),
    [queryClient],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      isUserLoading: userLoading,
      user: user ?? null,
      isSessionLoading: sessionLoading,
      session: session ?? null,
      refetchUser,
      refetchSession,
    }),
    [user, userLoading, session, sessionLoading, refetchUser, refetchSession],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('Must be used within AuthProvider');
  return ctx;
}

export function useUser(): UserContextValue {
  const { isUserLoading, user, refetchUser } = useAuthContext();
  return {
    user,
    isLoading: isUserLoading,
    isAuthenticated: user != null,
    refetch: refetchUser,
  };
}

export function useSession(): SessionContextValue {
  const { isSessionLoading, session, refetchSession } = useAuthContext();
  return {
    session,
    isLoading: isSessionLoading,
    isFreshJwt:
      session != null &&
      session.authMethod != null &&
      session.authMethod !== 'refresh',
    refetch: refetchSession,
  };
}

