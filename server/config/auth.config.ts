import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET must be set and at least 16 characters');
  }
  return {
    secret,
    verificationExpiresIn: 3600,
  };
});
