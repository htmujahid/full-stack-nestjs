import { Mail, Phone, Shield, User } from 'lucide-react';
import { format } from 'date-fns';
import { useUser } from '@/components/providers/auth-provider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function HomePage() {
  const { user } = useUser();

  if (!user) return null;

  const joinDate = user.createdAt
    ? format(new Date(user.createdAt), 'MMMM d, yyyy')
    : null;

  return (
    <div className="container mx-auto max-w-4xl space-y-8 px-4 py-8">
      {/* Welcome section */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <Avatar className="size-16 sm:size-20">
          <AvatarImage src={user.image ?? undefined} alt={user.name} />
          <AvatarFallback className="text-lg">
            {user.name?.slice(0, 2).toUpperCase() ?? <User className="size-8" />}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome back, {user.name}
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s an overview of your account.
          </p>
        </div>
      </section>

      {/* Profile details card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Mail className="size-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Email</p>
                <p className="truncate font-medium">{user.email}</p>
                {user.emailVerified && (
                  <Badge variant="secondary" className="mt-1">
                    Verified
                  </Badge>
                )}
              </div>
            </div>
            {user.username && (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
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
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <Phone className="size-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    Phone
                  </p>
                  <p className="truncate font-medium">{user.phone}</p>
                  {user.phoneVerified && (
                    <Badge variant="secondary" className="mt-1">
                      Verified
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Security & role card */}
      <Card>
        <CardHeader>
          <CardTitle>Security & role</CardTitle>
          <CardDescription>Account security status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant={user.twoFactorEnabled ? 'default' : 'outline'}>
              <Shield className="size-3" />
              {user.twoFactorEnabled ? '2FA enabled' : '2FA disabled'}
            </Badge>
            <Badge variant="secondary" className="capitalize">
              {user.role}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Member since */}
      {joinDate && (
        <p className="text-center text-sm text-muted-foreground">
          Member since {joinDate}
        </p>
      )}
    </div>
  );
}
