import { lazy } from 'react';
import { Route } from 'react-router';
import { ProtectedRoute } from '@/components/protected-route';

const CoreLayout = lazy(() => import('./components/core-layout'));
const CoreIndexPage = lazy(() => import('./pages/index'));
const UsersIndexPage = lazy(() => import('./pages/users/index'));
const UserShowPage = lazy(() => import('./pages/users/show'));
const UserNewPage = lazy(() => import('./pages/users/new'));
const UserEditPage = lazy(() => import('./pages/users/edit'));

export const coreRoutes = (
  <Route path="core" element={<ProtectedRoute />}>
    <Route element={<CoreLayout />}>
      <Route index element={<CoreIndexPage />} />
      <Route path="users">
        <Route index element={<UsersIndexPage />} />
        <Route path="new" element={<UserNewPage />} />
        <Route path=":id" element={<UserShowPage />} />
        <Route path=":id/edit" element={<UserEditPage />} />
      </Route>
    </Route>
  </Route>
);
