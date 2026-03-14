import { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  ME_QUERY_KEY,
  SESSION_QUERY_KEY,
  useSession,
  useUser,
} from '@/components/providers/auth-provider';
import { paths } from '@/config/paths.config';
import { useSignOutMutation } from '@/modules/auth/lib/query';
import { Spinner } from '@/components/ui/spinner';

type FreshJwtRouteProps = {
  redirectTo?: string;
};

export function FreshJwtRoute({ redirectTo = paths.auth.signIn }: FreshJwtRouteProps) {
  const { isAuthenticated, isLoading } = useUser();
  const { isFreshJwt, isLoading: isSessionLoading } = useSession();
  const [sessionVerified, setSessionVerified] = useState(false);
  const loading = isLoading || isSessionLoading;
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signOut = useSignOutMutation();
  const signedOut = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || loading) return;
    void queryClient
      .invalidateQueries({ queryKey: SESSION_QUERY_KEY })
      .then(() => setSessionVerified(true));
  }, [isAuthenticated, loading, queryClient]);

  useEffect(() => {
    if (
      !sessionVerified ||
      !isAuthenticated ||
      isFreshJwt ||
      signedOut.current ||
      signOut.isPending
    ) {
      return;
    }
    signedOut.current = true;
    signOut.mutate(undefined, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
        navigate(redirectTo, { state: { from: location }, replace: true });
      },
    });
  }, [
    sessionVerified,
    isAuthenticated,
    isFreshJwt,
    redirectTo,
    location,
    queryClient,
    navigate,
  ]);

  const showSpinner =
    loading || (isAuthenticated && (!sessionVerified || !isFreshJwt));

  if (showSpinner) {
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
