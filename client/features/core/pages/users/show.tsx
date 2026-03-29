import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { paths } from '@/config/paths.config';
import {
  useUserQuery,
  useDeleteUserMutation,
  getUserErrorMessage,
} from '../../lib/query';
import { UserDeleteDialog } from '../../components/user-delete-dialog';
import { UserProfileCard } from '../../components/user-profile-card';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

export default function UserShowPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: user, isLoading, isError } = useUserQuery(id!);
  const deleteUser = useDeleteUserMutation();

  if (!id) return null;

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">User not found</h1>
        <p className="text-muted-foreground">
          This user may have been deleted or the ID is invalid.
        </p>
        <Link
          to={paths.core.users}
          className={buttonVariants({ variant: 'outline' })}
        >
          Back to users
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex gap-2">
          <Link
            to={paths.core.userEdit(id)}
            className={buttonVariants({ variant: 'default' })}
          >
            Edit
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="icon" />}
            >
              <MoreHorizontal className="size-4" />
              <span className="sr-only">More</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                Delete user
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <UserProfileCard user={user} />

      <UserDeleteDialog
        user={user}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => {
          toast.success('User deleted');
          navigate(paths.core.users);
        }}
      />
    </div>
  );
}
