export const CREDENTIAL_PROVIDER = 'credential';
export const SALT_ROUNDS = 10;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export const AUTH_THROTTLE_TTL_MS = 60_000; // 1 minute
export const AUTH_THROTTLE_LIMIT = 5;

export const SESSION_COOKIE_NAME = 'session_token';
export const SESSION_EXPIRES_IN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const SESSION_REMEMBER_ME_EXPIRES_IN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
