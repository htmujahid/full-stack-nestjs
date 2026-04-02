import {
  TOTP,
  NobleCryptoPlugin,
  ScureBase32Plugin,
} from 'otplib';
import { TOTP_DIGITS, TOTP_PERIOD } from '../auth/auth.constants';

export function makeTOTP(secret: string, issuer?: string, label?: string): TOTP {
  return new TOTP({
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret,
    crypto: new NobleCryptoPlugin(),
    base32: new ScureBase32Plugin(),
    ...(issuer !== undefined ? { issuer } : {}),
    ...(label !== undefined ? { label } : {}),
  });
}
