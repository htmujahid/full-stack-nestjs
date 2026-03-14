import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TwoFactorOtpForm } from '../components/two-factor-otp-form';

export default function TwoFactorOtpPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Check your email</CardTitle>
          <CardDescription>
            Enter the 6-digit code we sent to your email address
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactorOtpForm />
        </CardContent>
      </Card>
    </div>
  );
}
