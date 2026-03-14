import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { AppHeader } from '@/components/app-header';
import { Spinner } from '@/components/ui/spinner';

export default function AccountLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader />
      <main className="flex flex-1 flex-col">
        <div className="container mx-auto max-w-2xl px-4 py-8">
          <Suspense
            fallback={
              <div className="flex min-h-[200px] items-center justify-center">
                <Spinner className="size-8 text-muted-foreground" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
