import { Link, useSearchParams } from 'react-router';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { OneTimeVerifyForm } from '../components/one-time-verify-form';

export default function OneTimeVerifyPage() {
  const [searchParams] = useSearchParams();
  const phone = searchParams.get('phone') ?? '';

  if (!phone) {
    return (
      <div className="flex w-full flex-col gap-6">
        <Card className="w-full">
          <CardContent>
            <p className="text-center text-sm text-muted-foreground">
              Missing phone number. Please{' '}
              <Link to="/auth/one-time/phone">request a new code</Link>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Enter verification code</CardTitle>
          <CardDescription>
            Enter the 6-digit code sent to {phone}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OneTimeVerifyForm />
        </CardContent>
      </Card>
    </div>
  );
}
