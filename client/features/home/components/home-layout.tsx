import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { AppHeader } from '@/components/app-header';
import { Spinner } from '@/components/ui/spinner';

export default function HomeLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader />
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="flex min-h-[200px] items-center justify-center">
              <Spinner className="size-8 text-muted-foreground" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
