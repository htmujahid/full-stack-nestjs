import { lazy } from 'react';
import { Navigate, Route } from 'react-router';

const AuthLayout = lazy(() => import('./components/auth-layout'));
const SignInPage = lazy(() => import('./pages/sign-in'));
const SignUpPage = lazy(() => import('./pages/sign-up'));
const ForgotPasswordPage = lazy(() => import('./pages/forgot-password'));
const ResetPasswordPage = lazy(() => import('./pages/reset-password'));
const MagicLinkPage = lazy(() => import('./pages/magic-link'));
const OneTimePhonePage = lazy(() => import('./pages/one-time-phone'));
const OneTimeVerifyPage = lazy(() => import('./pages/one-time-verify'));
const TwoFactorPage = lazy(() => import('./pages/two-factor'));
const TwoFactorOtpPage = lazy(() => import('./pages/two-factor-otp'));
const AuthErrorPage = lazy(() => import('./pages/error'));

export const authRoutes = (
  <Route path="auth" element={<AuthLayout />}>
    <Route path="sign-in" element={<SignInPage />} />
    <Route path="two-factor" element={<TwoFactorPage />} />
    <Route path="two-factor-otp" element={<TwoFactorOtpPage />} />
    <Route path="sign-up" element={<SignUpPage />} />
    <Route path="forgot-password" element={<ForgotPasswordPage />} />
    <Route path="reset-password" element={<ResetPasswordPage />} />
    <Route path="magic-link" element={<MagicLinkPage />} />
    <Route path="one-time">
      <Route index element={<Navigate to="/auth/magic-link" replace />} />
      <Route path="phone" element={<OneTimePhonePage />} />
      <Route path="verify" element={<OneTimeVerifyPage />} />
    </Route>
    <Route path="error" element={<AuthErrorPage />} />
  </Route>
);
