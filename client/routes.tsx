import { Suspense } from 'react';
import { Routes } from 'react-router';
import { Spinner } from '@/components/ui/spinner';
import { homeRoutes } from '@/modules/home/routes';
import { authRoutes } from '@/modules/auth/routes';

export function AppRoutes() {
  return (
    <Suspense fallback={<Spinner className="size-8" />}>
      <Routes>
        {homeRoutes}
        {authRoutes}
      </Routes>
    </Suspense>
  );
}
