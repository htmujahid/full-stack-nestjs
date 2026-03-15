/**
 * Centralized route paths. Use these instead of hardcoded strings.
 * For full URLs (e.g. callbackURL), combine with origin: `${origin}${paths.auth.signIn}`
 */
export const paths = {
  auth: {
    signIn: '/auth/sign-in',
    signUp: '/auth/sign-up',
    twoFactor: '/auth/two-factor',
    twoFactorOtp: '/auth/two-factor-otp',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
    magicLink: '/auth/magic-link',
    oneTime: '/auth/one-time',
    oneTimePhone: '/auth/one-time/phone',
    oneTimeVerify: '/auth/one-time/verify',
    error: '/auth/error',
  },
  home: '/home',
  core: {
    index: '/core',
    settings: '/core/settings',
    users: '/core/users',
    userNew: '/core/users/new',
    user: (id: string) => `/core/users/${id}`,
    userEdit: (id: string) => `/core/users/${id}/edit`,
  },
  account: {
    profile: '/account/profile',
    verification: '/account/verification',
    security: '/account/security',
  },
  terms: '/terms',
  privacy: '/privacy',
} as const;

export type Paths = typeof paths;
