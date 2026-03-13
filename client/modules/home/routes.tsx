import { lazy } from 'react';
import { Route } from 'react-router';
import { ProtectedRoute } from '@/components/protected-route';

const HomeLayout = lazy(() => import('./layouts/home-layout'));
const HomePage = lazy(() => import('./pages/index'));

export const homeRoutes = (
  <Route path="home" element={<ProtectedRoute />}>
    <Route element={<HomeLayout />}>
      <Route index element={<HomePage />} />
    </Route>
  </Route>
);
