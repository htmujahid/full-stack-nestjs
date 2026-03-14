import { Navigate, Outlet, useLocation } from 'react-router';
import { useUser } from '@/components/providers/auth-provider';
import { Spinner } from '@/components/ui/spinner';

type ProtectedRouteProps = {
  /** Where to redirect when unauthenticated. Default: /auth/sign-in */
  redirectTo?: string;
};

export function ProtectedRoute({ redirectTo = '/auth/sign-in' }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useUser();
  const location = useLocation();

  if (isLoading) {
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

  if (!isAuthenticated) {
    const from = location.pathname + location.search + location.hash;
    const search = new URLSearchParams({ redirectTo: from }).toString();
    return <Navigate to={{ pathname: redirectTo, search: search ? `?${search}` : '' }} replace />;
  }

  return <Outlet />;
}
