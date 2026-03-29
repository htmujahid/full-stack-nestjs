import { useUser } from '@/components/providers/auth-provider';
import { SecurityPasswordCard } from '../components/security-password-card';
import { SecurityTwoFactorCard } from '../components/security-two-factor-card';
import { SecurityAccountLinkingCard } from '../components/security-account-linking-card';

export default function SecurityPage() {
  const { user } = useUser();

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Security</h1>
        <p className="text-muted-foreground">
          Password, two-factor authentication, and sign-in methods
        </p>
      </div>

      <SecurityPasswordCard />
      <SecurityTwoFactorCard user={user} />
      <SecurityAccountLinkingCard />
    </div>
  );
}
