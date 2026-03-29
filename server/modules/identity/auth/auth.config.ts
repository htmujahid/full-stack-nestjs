import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  if (!accessSecret || accessSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must be set and at least 32 characters');
  }

  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!refreshSecret || refreshSecret.length < 32) {
    throw new Error(
      'JWT_REFRESH_SECRET must be set and at least 32 characters',
    );
  }

  return {
    accessSecret,
    refreshSecret,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
});
