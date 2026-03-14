import { useUser } from '@/components/providers/auth-provider';
import { ProfileEmailCard } from '../components/profile-email-card';
import { ProfilePhoneCard } from '../components/profile-phone-card';

export default function VerificationPage() {
  const { user } = useUser();

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Verification</h1>
        <p className="text-muted-foreground">
          Verify your email and phone
        </p>
      </div>

      <ProfileEmailCard user={user} />
      <ProfilePhoneCard user={user} />
    </div>
  );
}
