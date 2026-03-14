import { lazy } from 'react';
import { Navigate, Route } from 'react-router';
import { FreshJwtRoute } from '@/components/fresh-jwt-route';
import { ProtectedRoute } from '@/components/protected-route';

const AccountLayout = lazy(() => import('./components/account-layout'));
const ProfilePage = lazy(() => import('./pages/profile'));
const VerificationPage = lazy(() => import('./pages/verification'));
const SecurityPage = lazy(() => import('./pages/security'));

export const accountRoutes = (
  <Route path="account" element={<ProtectedRoute />}>
    <Route element={<AccountLayout />}>
      <Route index element={<Navigate to="/account/profile" replace />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="verification" element={<FreshJwtRoute />}>
        <Route index element={<VerificationPage />} />
      </Route>
      <Route path="security" element={<FreshJwtRoute />}>
        <Route index element={<SecurityPage />} />
      </Route>
    </Route>
  </Route>
);
