import { lazy } from 'react';
import { Route } from 'react-router';

const AuthLayout = lazy(() => import('./layouts/auth-layout'));
const SignInPage = lazy(() => import('./pages/sign-in'));
const SignUpPage = lazy(() => import('./pages/sign-up'));
const ForgotPasswordPage = lazy(() => import('./pages/forgot-password'));
const ResetPasswordPage = lazy(() => import('./pages/reset-password'));

export const authRoutes = (
  <Route path="auth" element={<AuthLayout />}>
    <Route path="sign-in" element={<SignInPage />} />
    <Route path="sign-up" element={<SignUpPage />} />
    <Route path="forgot-password" element={<ForgotPasswordPage />} />
    <Route path="reset-password" element={<ResetPasswordPage />} />
  </Route>
);
