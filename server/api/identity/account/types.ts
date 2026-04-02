export type LinkAccountData = {
  providerId: string;
  accountId: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  scope?: string | null;
};