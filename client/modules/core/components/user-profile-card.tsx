import { format } from 'date-fns';
import { Mail, Phone, Shield, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { UserRoleBadge } from './user-role-badge';
import type { User as UserType } from '../lib/query';

export function UserProfileCard({ user }: { user: UserType }) {
  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <Avatar className="size-16 sm:size-20">
          <AvatarImage src={user.image ?? undefined} alt={user.name} />
          <AvatarFallback className="text-lg">
            {user.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-wrap gap-2">
          <UserRoleBadge role={user.role} />
          {user.emailVerified && (
            <Badge variant="secondary">Email verified</Badge>
          )}
          {user.phoneVerified && (
            <Badge variant="secondary">Phone verified</Badge>
          )}
          {user.twoFactorEnabled && (
            <Badge variant="default">
              <Shield className="size-3" />
              2FA enabled
            </Badge>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>User account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Mail className="size-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  Email
                </p>
                <p className="truncate font-medium">{user.email}</p>
              </div>
            </div>

            {user.username && (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <User className="size-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    Username
                  </p>
                  <p className="truncate font-medium">@{user.username}</p>
                </div>
              </div>
            )}

            {user.phone && (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Phone className="size-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    Phone
                  </p>
                  <p className="truncate font-medium">{user.phone}</p>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Created {format(new Date(user.createdAt), 'PPpp')} · Updated{' '}
            {format(new Date(user.updatedAt), 'PPpp')}
          </p>
        </CardContent>
      </Card>
    </>
  );
}
