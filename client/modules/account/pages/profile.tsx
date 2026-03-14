import { useAuth } from '@/components/providers/auth-provider';
import { ProfileInfoCard } from '../components/profile-info-card';
import { ProfileEmailCard } from '../components/profile-email-card';
import { ProfilePhoneCard } from '../components/profile-phone-card';
import { ProfileRoleCard } from '../components/profile-role-card';

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">
          Your identity and contact information
        </p>
      </div>

      <ProfileInfoCard key={user.updatedAt} user={user} />
      <ProfileEmailCard user={user} />
      <ProfilePhoneCard user={user} />
      <ProfileRoleCard user={user} />
    </div>
  );
}
