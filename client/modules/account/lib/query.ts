import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetcher } from '@/modules/auth/lib/query';
import { ME_QUERY_KEY } from '@/components/providers/auth-provider';

// ─── Types (mirror server DTOs / responses) ───────────────────────────────────

export type UpdateMeInput = {
  name?: string;
  username?: string;
  image?: string;
};

export type UpdateEmailInput = {
  newEmail: string;
  callbackURL?: string;
  errorURL?: string;
};

export type UpdatePhoneInput = {
  newPhone: string;
};

export type VerifyPhoneChangeInput = {
  phone: string;
  code: string;
};

export type UpdatePasswordInput = {
  newPassword: string;
};

export type LinkedAccount = {
  id: string;
  providerId: string;
  accountId: string;
  scope: string | null;
  accessTokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Enable2FAInput = {
  issuer?: string;
};

export type Enable2FAResult = {
  totpURI: string;
  backupCodes: string[];
};

export type VerifyEnableTotpInput = {
  code: string;
};

export type Disable2FAInput = Record<string, never>;

export type GetTotpUriInput = Record<string, never>;

export type GenerateBackupCodesInput = Record<string, never>;

export type UploadResult = {
  url: string;
  key: string;
  size: number;
  name: string;
};

// ─── Query ─────────────────────────────────────────────────────────────────────

const ACCOUNTS_QUERY_KEY = ['accounts'] as const;

export function useAccountsQuery() {
  return useQuery({
    queryKey: ACCOUNTS_QUERY_KEY,
    queryFn: async () => {
      const { data } = await fetcher<LinkedAccount[]>('/api/account');
      return data;
    },
  });
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

function useInvalidateMe() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
}

export function useUpdateMeMutation() {
  const invalidateMe = useInvalidateMe();
  return useMutation({
    mutationFn: async (input: UpdateMeInput) => {
      const { data } = await fetcher('/api/me', {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
      return data;
    },
    onSuccess: invalidateMe,
  });
}

export function useUpdateEmailMutation() {
  const invalidateMe = useInvalidateMe();
  return useMutation({
    mutationFn: async (input: UpdateEmailInput) => {
      const { data } = await fetcher<{ ok: boolean }>('/api/auth/email', {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
      return data;
    },
    onSuccess: invalidateMe,
  });
}

export function useUpdatePhoneMutation() {
  const invalidateMe = useInvalidateMe();
  return useMutation({
    mutationFn: async (input: UpdatePhoneInput) => {
      const { data } = await fetcher<{ ok: boolean }>('/api/auth/phone', {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
      return data;
    },
    onSuccess: invalidateMe,
  });
}

export function useVerifyPhoneChangeMutation() {
  const invalidateMe = useInvalidateMe();
  return useMutation({
    mutationFn: async (input: VerifyPhoneChangeInput) => {
      const { data } = await fetcher<{ ok: boolean; error?: string }>(
        '/api/auth/verify-phone-change',
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
      return data;
    },
    onSuccess: invalidateMe,
  });
}

export function useUpdatePasswordMutation() {
  const invalidateMe = useInvalidateMe();
  return useMutation({
    mutationFn: async (input: UpdatePasswordInput) => {
      const { data } = await fetcher<{ ok: boolean }>('/api/auth/password', {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
      return data;
    },
    onSuccess: invalidateMe,
  });
}

export function useAddPasswordMutation() {
  const invalidateMe = useInvalidateMe();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdatePasswordInput) => {
      const { data } = await fetcher<{ ok: boolean }>(
        '/api/auth/add-password',
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
      return data;
    },
    onSuccess: () => {
      invalidateMe();
      qc.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY });
    },
  });
}

export function useEnable2FAMutation() {
  return useMutation({
    mutationFn: async (input: Enable2FAInput) => {
      const { data } = await fetcher<Enable2FAResult>(
        '/api/two-factor/enable',
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
      return data;
    },
  });
}

export function useVerifyEnableTotpMutation() {
  const invalidateMe = useInvalidateMe();
  return useMutation({
    mutationFn: async (input: VerifyEnableTotpInput) => {
      const { data } = await fetcher<{ ok: boolean }>(
        '/api/two-factor/enable/verify',
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
      return data;
    },
    onSuccess: invalidateMe,
  });
}

export function useDisable2FAMutation() {
  const invalidateMe = useInvalidateMe();
  return useMutation({
    mutationFn: async (input: Disable2FAInput) => {
      const { data } = await fetcher<{ ok: boolean }>(
        '/api/two-factor/disable',
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
      return data;
    },
    onSuccess: invalidateMe,
  });
}

export function useGetTotpUriMutation() {
  return useMutation({
    mutationFn: async (input: GetTotpUriInput) => {
      const { data } = await fetcher<{ totpURI: string }>(
        '/api/two-factor/get-totp-uri',
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
      return data;
    },
  });
}

export function useGenerateBackupCodesMutation() {
  return useMutation({
    mutationFn: async (input: GenerateBackupCodesInput) => {
      const { data } = await fetcher<{ backupCodes: string[] }>(
        '/api/two-factor/generate-backup-codes',
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
      return data;
    },
  });
}

export function useUploadMutation() {
  return useMutation({
    mutationFn: async ({ file, prefix }: { file: File; prefix?: string }) => {
      const form = new FormData();
      form.append('file', file);
      if (prefix) form.append('prefix', prefix);
      const { data } = await fetcher<UploadResult>('/api/upload', {
        method: 'POST',
        body: form,
      });
      return data;
    },
  });
}

export function useDeleteUploadMutation() {
  return useMutation({
    mutationFn: async ({ key, url }: { key?: string; url?: string }) => {
      await fetcher('/api/upload', {
        method: 'DELETE',
        body: JSON.stringify({ key, url }),
      });
    },
  });
}
