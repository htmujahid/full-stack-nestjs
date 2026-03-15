import { Link } from 'react-router';
import { Activity, Settings, Users } from 'lucide-react';
import { paths } from '@/config/paths.config';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const CORE_LINKS = [
  {
    title: 'Users',
    description: 'Manage user accounts, roles, and permissions',
    href: paths.core.users,
    icon: Users,
    disabled: false,
  },
  {
    title: 'Settings',
    description: 'Application and system configuration',
    href: paths.core.index, // placeholder — no settings page yet
    icon: Settings,
    disabled: true,
  },
  {
    title: 'Health',
    description: 'Service status and diagnostics',
    href: paths.core.index, // placeholder — /api/health exists but no UI
    icon: Activity,
    disabled: true,
  },
] as const;

export default function CoreIndexPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <p className="text-muted-foreground">
          Core administration and configuration
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CORE_LINKS.map(({ title, description, href, icon: Icon, disabled }) => (
          <Card
            key={title}
            className={disabled ? 'opacity-60' : 'transition-colors hover:bg-muted/50'}
          >
            <CardHeader>
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="size-5 text-primary" />
              </div>
              <CardTitle className="mt-2">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              {disabled ? (
                <span className="text-sm text-muted-foreground">Coming soon</span>
              ) : (
                <Link
                  to={href}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Open →
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
