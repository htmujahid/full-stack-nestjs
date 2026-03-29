import { useMutation } from '@tanstack/react-query';
import { fetcher, FetcherError } from '@/lib/fetcher';

export { fetcher, FetcherError };

// ─── Types (mirror server DTOs) ───────────────────────────────────────────────

export type SignInInput = {
  identifier: string;
  password: string;
  rememberMe?: boolean;
};

export type SignInSuccess = {
  user: { id: string; email?: string };
  accessToken: string;
  refreshToken: string;
};

export type SignInResponse =
  | SignInSuccess
  | { twoFactorRedirect: true }
  | { redirected: true };

export type SignUpInput = {
  name: string;
  email: string;
  password: string;
  username?: string;
  phone?: string;
  callbackURL?: string;
};

export type SignUpResponse = { user: { id: string } };

export type ForgotPasswordInput = {
  email: string;
  callbackURL?: string;
  errorURL?: string;
};

export type ForgotPasswordResponse = { ok: boolean };

export type ResetPasswordInput = {
  token: string;
  newPassword: string;
};

export type ResetPasswordResponse = { ok: boolean };

export type SignOutResponse = { ok: boolean };

export type SignInEmailInput = {
  email: string;
  callbackURL?: string;
  errorURL?: string;
};

export type SignInEmailResponse = { ok: boolean };

export type SignInPhoneInput = {
  phone: string;
  callbackURL?: string;
};

export type SignInPhoneResponse = { ok: boolean };

export type VerifyPhoneOtpInput = {
  phone: string;
  code: string;
  rememberMe?: boolean;
  callbackURL?: string;
};

export type VerifyTotpInput = { code: string; trustDevice?: boolean };
export type VerifyOtpInput = { code: string; trustDevice?: boolean };
export type VerifyBackupCodeInput = { code: string; trustDevice?: boolean };
export type TwoFactorVerifyResponse = {
  ok: true;
  accessToken: string;
  refreshToken: string;
};

// ─── Mutations ───────────────────────────────────────────────────────────────

const AUTH_OPTIONS = { skipAuthRetry: true as const };

export function useSignInMutation() {
  return useMutation({
    mutationFn: async (input: SignInInput) => {
      const { data } = await fetcher<SignInResponse>(
        '/api/auth/sign-in/password',
        {
          method: 'POST',
          body: JSON.stringify(input),
          ...AUTH_OPTIONS,
        },
      );
      return data;
    },
  });
}

export function useSignUpMutation() {
  return useMutation({
    mutationFn: async (input: SignUpInput) => {
      const { data } = await fetcher<SignUpResponse>(
        '/api/auth/sign-up/password',
        {
          method: 'POST',
          body: JSON.stringify(input),
          ...AUTH_OPTIONS,
        },
      );
      return data;
    },
  });
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: async (input: ForgotPasswordInput) => {
      const { data } = await fetcher<ForgotPasswordResponse>(
        '/api/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify(input),
          ...AUTH_OPTIONS,
        },
      );
      return data;
    },
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: async (input: ResetPasswordInput) => {
      const { data } = await fetcher<ResetPasswordResponse>(
        '/api/auth/reset-password',
        {
          method: 'POST',
          body: JSON.stringify(input),
          ...AUTH_OPTIONS,
        },
      );
      return data;
    },
  });
}

export function useSignOutMutation() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await fetcher<SignOutResponse>('/api/auth/sign-out', {
        method: 'POST',
        ...AUTH_OPTIONS,
      });
      return data;
    },
  });
}

export function useSignInEmailMutation() {
  return useMutation({
    mutationFn: async (input: SignInEmailInput) => {
      const { data } = await fetcher<{ ok: boolean }>(
        '/api/auth/sign-in/email',
        {
          method: 'POST',
          body: JSON.stringify(input),
          ...AUTH_OPTIONS,
        },
      );
      return data;
    },
  });
}

export function useSignInPhoneMutation() {
  return useMutation({
    mutationFn: async (input: SignInPhoneInput) => {
      const { data } = await fetcher<{ ok: boolean }>(
        '/api/auth/sign-in/phone',
        {
          method: 'POST',
          body: JSON.stringify(input),
          ...AUTH_OPTIONS,
        },
      );
      return data;
    },
  });
}

export function useVerifyPhoneOtpMutation() {
  return useMutation({
    mutationFn: async (input: VerifyPhoneOtpInput) => {
      const { data } = await fetcher<SignInResponse>(
        '/api/auth/verify-phone-otp',
        {
          method: 'POST',
          body: JSON.stringify(input),
          ...AUTH_OPTIONS,
        },
      );
      return data;
    },
  });
}

export function useVerifyTotpMutation() {
  return useMutation({
    mutationFn: async (input: VerifyTotpInput) => {
      const { data } = await fetcher<TwoFactorVerifyResponse>(
        '/api/two-factor/verify-totp',
        { method: 'POST', body: JSON.stringify(input), ...AUTH_OPTIONS },
      );
      return data;
    },
  });
}

export function useVerifyOtpMutation() {
  return useMutation({
    mutationFn: async (input: VerifyOtpInput) => {
      const { data } = await fetcher<TwoFactorVerifyResponse>(
        '/api/two-factor/verify-otp',
        { method: 'POST', body: JSON.stringify(input), ...AUTH_OPTIONS },
      );
      return data;
    },
  });
}

export function useVerifyBackupCodeMutation() {
  return useMutation({
    mutationFn: async (input: VerifyBackupCodeInput) => {
      const { data } = await fetcher<TwoFactorVerifyResponse>(
        '/api/two-factor/verify-backup-code',
        { method: 'POST', body: JSON.stringify(input), ...AUTH_OPTIONS },
      );
      return data;
    },
  });
}

export function useSendTwoFactorOtpMutation() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await fetcher<{ ok: boolean }>(
        '/api/two-factor/send-otp',
        { method: 'POST', ...AUTH_OPTIONS },
      );
      return data;
    },
  });
}

// ─── Error helpers ────────────────────────────────────────────────────────────

export function getAuthErrorMessage(error: unknown): string {
  if (
    error instanceof FetcherError &&
    typeof error.body === 'object' &&
    error.body
  ) {
    const b = error.body as { message?: unknown };
    if (Array.isArray(b.message)) return b.message.join(', ');
    if (typeof b.message === 'string') return b.message;
  }
  if (error instanceof FetcherError) return error.message;
  return 'Something went wrong';
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof FetcherError && error.status === 401;
}
