import { lazy } from 'react';
import { Route } from 'react-router';

const HomeLayout = lazy(() => import('./layouts/home-layout'));
const HomePage = lazy(() => import('./pages/index'));

export const homeRoutes = (
  <Route path="home" element={<HomeLayout />}>
    <Route index element={<HomePage />} />
  </Route>
);
