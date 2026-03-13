import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/components/providers/auth-provider';
import { Spinner } from '@/components/ui/spinner';

type ProtectedRouteProps = {
  /** Where to redirect when unauthenticated. Default: /auth/sign-in */
  redirectTo?: string;
};

export function ProtectedRoute({ redirectTo = '/auth/sign-in' }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
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
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  return <Outlet />;
}
