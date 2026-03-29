import { Suspense } from 'react';
import { Routes } from 'react-router';
import { Spinner } from '@/components/ui/spinner';
import { homeRoutes } from '@/features/home/routes';
import { coreRoutes } from '@/features/core/routes';
import { authRoutes } from '@/features/auth/routes';
import { accountRoutes } from '@/features/account/routes';

function FullPageFallback() {
  return (
    <div
      className="flex min-h-svh items-center justify-center bg-background"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <Spinner className="size-8 text-muted-foreground" />
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<FullPageFallback />}>
      <Routes>
        {homeRoutes}
        {coreRoutes}
        {accountRoutes}
        {authRoutes}
      </Routes>
    </Suspense>
  );
}
