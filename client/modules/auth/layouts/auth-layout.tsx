import { Suspense } from 'react';
import { GalleryVerticalEnd } from 'lucide-react';
import { Link, Outlet } from 'react-router';
import { Spinner } from '@/components/ui/spinner';

export default function AuthLayout() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-muted p-6 transition-colors md:p-10">
      <div className="flex items-center w-full max-w-sm flex-col gap-6">
        <Link to="/home" className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GalleryVerticalEnd className="size-4" />
          </div>
          crude
        </Link>
        <Suspense
          fallback={
            <div className="flex min-h-[320px] w-full items-center justify-center">
              <Spinner />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
