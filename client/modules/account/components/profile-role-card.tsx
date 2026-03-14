import { ShieldCheck } from 'lucide-react';
import type { User as AuthUser } from '@/components/providers/auth-provider';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function ProfileRoleCard({ user }: { user: AuthUser }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Role</CardTitle>
        <CardDescription>
          Your account role. Assigned by administrators and cannot be changed
          here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <ShieldCheck className="size-5 text-primary" />
          </div>
          <div>
            <p className="font-medium capitalize">{user.role}</p>
            <Badge variant="secondary" className="mt-1">
              Read-only
            </Badge>
          </div>
        </div>
        <div>
          <h3 className="mb-2 font-medium">Role permissions</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Member: Standard access to your own data</li>
            <li>• Admin: Full access including user management</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
