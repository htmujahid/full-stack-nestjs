export const CREDENTIAL_PROVIDER = 'credential';
export const GOOGLE_PROVIDER = 'google';
export const SALT_ROUNDS = 10;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export const AUTH_THROTTLE_TTL_MS = 60_000; // 1 minute
export const AUTH_THROTTLE_LIMIT = 5;

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

export const VERIFICATION_EXPIRES_MS = 60 * 60 * 1000; // 1 hour
export const ACCESS_EXPIRES_MS = 15 * 60 * 1000; // 15 minutes
export const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const REFRESH_REMEMBER_ME_EXPIRES_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
