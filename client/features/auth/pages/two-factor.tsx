import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TwoFactorForm } from '../components/two-factor-form';

export default function TwoFactorPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Two-factor authentication</CardTitle>
          <CardDescription>
            Enter a code from your authenticator app or use a backup code
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactorForm />
        </CardContent>
      </Card>
    </div>
  );
}
