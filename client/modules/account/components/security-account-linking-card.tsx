import { Link2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAccountsQuery,
  useUnlinkAccountMutation,
  getLinkAccountUrl,
} from '../lib/query';
import { getAuthErrorMessage } from '@/modules/auth/lib/query';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const PROVIDER_LABELS: Record<string, string> = {
  credential: 'Email & password',
  google: 'Google',
};

const AVAILABLE_PROVIDERS = [
  { providerId: 'google', providerLabel: 'Google' },
];

export function SecurityAccountLinkingCard() {
  const { data: accounts = [] } = useAccountsQuery();
  const unlinkAccount = useUnlinkAccountMutation();

  const linkedProviderIds = new Set(accounts.map((a) => a.providerId));
  const providersToLink = AVAILABLE_PROVIDERS.filter(
    (p) => !linkedProviderIds.has(p.providerId),
  );
  const canUnlink = accounts.length > 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account linking</CardTitle>
        <CardDescription>
          Connect additional sign-in methods. You must keep at least one method
          linked.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between rounded-lg border bg-muted/30 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <Link2 className="size-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">
                    {PROVIDER_LABELS[account.providerId] ?? account.providerId}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {account.providerId === 'credential'
                      ? 'Primary sign-in method'
                      : 'Linked'}
                  </p>
                </div>
              </div>
              {canUnlink && account.providerId !== 'credential' && (
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={unlinkAccount.isPending}
                  aria-label="Unlink account"
                  onClick={() =>
                    unlinkAccount.mutate(account.id, {
                      onSuccess: () => toast.success('Account unlinked'),
                      onError: (err) =>
                        toast.error(getAuthErrorMessage(err)),
                    })
                  }
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
        {providersToLink.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-medium">Link another account</h3>
            {providersToLink.map((provider) => (
              <div
                key={provider.providerId}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                    <Link2 className="size-5 text-muted-foreground" />
                  </div>
                  <p className="font-medium capitalize">
                    {provider.providerLabel}
                  </p>
                </div>
                <Button
                  onClick={() => {
                    window.location.href = getLinkAccountUrl(
                      provider.providerId,
                      '/account/security',
                    );
                  }}
                >
                  Link {provider.providerLabel}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
