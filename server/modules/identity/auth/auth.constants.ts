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
export const RESET_PASSWORD_EXPIRES_MS = 60 * 60 * 1000; // 1 hour

export const EMAIL_VERIFICATION_TYPE = 'email-verification';
export const EMAIL_CHANGE_VERIFICATION_TYPE = 'email-change';
export const EMAIL_CHANGE_EXPIRES_MS = 60 * 60 * 1000; // 1 hour
export const RESET_PASSWORD_IDENTIFIER_PREFIX = 'reset-password:';
export const ACCESS_EXPIRES_MS = 15 * 60 * 1000; // 15 minutes
export const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const REFRESH_REMEMBER_ME_EXPIRES_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const TFA_PENDING_COOKIE = '2fa_pending';
export const TFA_PENDING_EXPIRES_MS = 10 * 60 * 1000; // 10 minutes
export const TRUST_DEVICE_COOKIE = 'trust_device';
export const TRUST_DEVICE_EXPIRES_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const TRUST_DEVICE_TYPE = '2fa-trust';
export const TFA_OTP_TYPE = '2fa-otp';
export const TFA_OTP_EXPIRES_MS = 3 * 60 * 1000; // 3 minutes
export const BACKUP_CODE_COUNT = 10;
export const BACKUP_CODE_LENGTH = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const TOTP_DIGITS = 6;
export const TOTP_PERIOD = 30;
