import { UserRole } from '../user/user-role.enum';

export type AuthMethod = 'password' | 'phone' | 'email' | 'google' | 'refresh';

export type JwtAccessPayload = {
  sub: string;
  role: UserRole;
  auth_method: AuthMethod;
};

export type JwtRefreshPayload = {
  sub: string;
  role: UserRole;
  sid: string; // session ID
  fid: string; // family ID
}

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
};

export type RequestContext = {
  ip: string | null;
  userAgent: string | null;
};

export type RefreshUser = {
  userId: string;
  role: UserRole;
  sessionId: string;
  familyId: string;
  rawRefreshToken: string;
};

export type AccessUser = {
  userId: string;
  role: UserRole;
  authMethod: AuthMethod;
};

export type OAuthProfile = {
  providerId: AuthMethod;
  accountId: string;
  email: string;
  name: string;
  image: string | null;
  accessToken: string;
  refreshToken: string | null;
};

export type OAuthAccount = {
  providerId: string;
  accountId: string;
  accessToken: string;
  refreshToken: string | null;
};
