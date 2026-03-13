import { Suspense } from 'react';
import { Link, Outlet, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Home, LogOut, User } from 'lucide-react';
import { useAuth, ME_QUERY_KEY } from '@/components/providers/auth-provider';
import { useSignOutMutation } from '@/modules/auth/lib/query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';

export default function HomeLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signOut = useSignOutMutation();

  const handleSignOut = () => {
    signOut.mutate(undefined, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
        navigate('/auth/sign-in', { replace: true });
      },
    });
  };

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="container mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link to="/home" className="font-semibold">
            crude
          </Link>
          <nav className="flex flex-1 items-center gap-4" />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar size="sm">
                    <AvatarImage src={user?.image ?? undefined} alt={user?.name} />
                    <AvatarFallback>
                      {user?.name?.slice(0, 2).toUpperCase() ?? <User className="size-4" />}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              }
            />
            <DropdownMenuContent className="w-48" align="end" sideOffset={8}>
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal text-foreground">
                  <div className="flex flex-col">
                    <span className="font-medium">{user?.name}</span>
                    <span className="text-xs text-muted-foreground">{user?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate('/home')}>
                  <Home className="size-4" />
                  Home
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={handleSignOut}
                  disabled={signOut.isPending}
                >
                  <LogOut className="size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
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
