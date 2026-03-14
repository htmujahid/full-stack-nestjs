import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Home, LogOut, Shield, User } from 'lucide-react';
import { ME_QUERY_KEY, useUser } from '@/components/providers/auth-provider';
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

interface AppHeaderProps {
  children?: React.ReactNode;
}

export function AppHeader({ children }: AppHeaderProps) {
  const { user } = useUser();
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
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="container mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link to="/home" className="font-semibold">
          crude
        </Link>
        <nav className="flex flex-1 items-center gap-4">{children}</nav>
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
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            align="end"
            side="bottom"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarImage src={user?.image ?? undefined} alt={user?.name} />
                    <AvatarFallback className="rounded-lg">
                      {user?.name?.slice(0, 2).toUpperCase() ?? (
                        <User className="size-4" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user?.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user?.email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigate('/home')}>
                <Home className="size-4" />
                Home
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/account/profile')}>
                <User className="size-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/account/verification')}>
                <BadgeCheck className="size-4" />
                Verification
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/account/security')}>
                <Shield className="size-4" />
                Security
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={handleSignOut}
              disabled={signOut.isPending}
            >
              <LogOut className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
