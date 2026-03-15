import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { format } from 'date-fns';
import { MoreHorizontal } from 'lucide-react';
import { paths } from '@/config/paths.config';
import type { User } from '../lib/query';
import { UserDeleteDialog } from './user-delete-dialog';
import { UserRoleBadge } from './user-role-badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableCell, TableRow } from '@/components/ui/table';

export function UserTableRow({ user }: { user: User }) {
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <TableRow>
        <TableCell>
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarImage src={user.image ?? undefined} alt={user.name} />
              <AvatarFallback className="text-xs">
                {user.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <Link
                to={paths.core.user(user.id)}
                className="font-medium hover:underline"
              >
                {user.name}
              </Link>
              {user.username && (
                <p className="text-xs text-muted-foreground">
                  @{user.username}
                </p>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">{user.email}</TableCell>
        <TableCell>
          <UserRoleBadge role={user.role} />
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {format(new Date(user.createdAt), 'PP')}
        </TableCell>
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" className="size-8" />}
            >
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => navigate(paths.core.user(user.id))}
              >
                View
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate(paths.core.userEdit(user.id))}
              >
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
      <UserDeleteDialog
        user={user}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
