import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  if (!accessSecret || accessSecret.length < 16) {
    throw new Error('JWT_ACCESS_SECRET must be set and at least 16 characters');
  }

  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!refreshSecret || refreshSecret.length < 16) {
    throw new Error('JWT_REFRESH_SECRET must be set and at least 16 characters');
  }

  return {
    accessSecret,
    refreshSecret,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
});
