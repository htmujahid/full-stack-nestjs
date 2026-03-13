import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetcher, FetcherError } from '@/lib/fetcher';

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

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refetch: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const ME_QUERY_KEY = ['me'] as const;

async function fetchMe(): Promise<User | null> {
  try {
    const { data } = await fetcher<User>('/api/me');
    return data;
  } catch (e) {
    if (e instanceof FetcherError && e.status === 401) return null;
    throw e;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading, refetch } = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: fetchMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user: user ?? null,
      isLoading,
      isAuthenticated: user != null,
      refetch,
    }),
    [user, isLoading, refetch],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { ME_QUERY_KEY };
