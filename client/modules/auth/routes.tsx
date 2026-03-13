import { lazy } from 'react';
import { Route } from 'react-router';

const AuthLayout = lazy(() => import('./layouts/auth-layout'));
const SignInPage = lazy(() => import('./pages/sign-in'));
const SignUpPage = lazy(() => import('./pages/sign-up'));

export const authRoutes = (
  <Route path="auth" element={<AuthLayout />}>
    <Route path="sign-in" element={<SignInPage />} />
    <Route path="sign-up" element={<SignUpPage />} />
  </Route>
);
