import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { Spinner } from '@/components/ui/spinner';

export default function HomeLayout() {
  return (
    <div>
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
  );
}
