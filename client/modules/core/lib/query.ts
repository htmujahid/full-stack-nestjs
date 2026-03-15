import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetcher, FetcherError } from '@/lib/fetcher';

export { FetcherError };

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'member' | 'admin' | 'superadmin';

export type User = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  phone: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  role: UserRole;
  image: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateUserInput = {
  name: string;
  email: string;
  username?: string | null;
  phone?: string | null;
  role?: UserRole;
};

export type UpdateUserInput = Partial<CreateUserInput>;

export type UsersPage = {
  data: User[];
  total: number;
  page: number;
  limit: number;
};

export type UsersQueryParams = {
  page: number;
  limit: number;
  search: string;
  roles: UserRole[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
};

// ─── Query keys ───────────────────────────────────────────────────────────────

export const USERS_QUERY_KEY = ['users'] as const;
export const usersPageQueryKey = (params: UsersQueryParams) =>
  ['users', 'list', params] as const;
export const userQueryKey = (id: string) => ['users', id] as const;

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useUsersQuery(params: UsersQueryParams) {
  return useQuery({
    queryKey: usersPageQueryKey(params),
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
        ...(params.search ? { search: params.search } : {}),
        ...(params.sortBy ? { sortBy: params.sortBy, sortOrder: params.sortOrder } : {}),
      });
      params.roles.forEach((r) => qs.append('roles', r));
      const { data } = await fetcher<UsersPage>(`/api/users?${qs}`);
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useUserQuery(id: string) {
  return useQuery({
    queryKey: userQueryKey(id),
    queryFn: async () => {
      const { data } = await fetcher<User>(`/api/users/${id}`);
      return data;
    },
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const { data } = await fetcher<User>('/api/users', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export function useUpdateUserMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateUserInput) => {
      const { data } = await fetcher<User>(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: userQueryKey(id) });
    },
  });
}

export function useDeleteUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await fetcher(`/api/users/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

// ─── Error helper ─────────────────────────────────────────────────────────────

export function getUserErrorMessage(error: unknown): string {
  if (error instanceof FetcherError && typeof error.body === 'object' && error.body) {
    const b = error.body as { message?: unknown };
    if (Array.isArray(b.message)) return b.message.join(', ');
    if (typeof b.message === 'string') return b.message;
  }
  if (error instanceof FetcherError) return error.message;
  return 'Something went wrong';
}
