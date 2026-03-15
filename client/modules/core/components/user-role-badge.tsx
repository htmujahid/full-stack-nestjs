import { Badge } from '@/components/ui/badge';
import type { UserRole } from '../lib/query';

export const ROLE_BADGE: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  superadmin: { label: 'Super Admin', variant: 'default' },
  admin: { label: 'Admin', variant: 'secondary' },
  member: { label: 'Member', variant: 'outline' },
};

export function UserRoleBadge({ role }: { role: UserRole }) {
  const config = ROLE_BADGE[role] ?? {
    label: role,
    variant: 'outline' as const,
  };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
