import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAccountsQuery } from '../lib/query';
import { Link2 } from 'lucide-react';

const PROVIDER_LABELS: Record<string, string> = {
  credential: 'Email & password',
  google: 'Google',
};

export function SecurityAccountLinkingCard() {
  const { data: accounts = [] } = useAccountsQuery();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign-in methods</CardTitle>
        <CardDescription>Accounts linked to your profile</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Link2 className="size-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">
                  {PROVIDER_LABELS[account.providerId] ?? account.providerId}
                </p>
                <p className="text-xs text-muted-foreground">Linked</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
