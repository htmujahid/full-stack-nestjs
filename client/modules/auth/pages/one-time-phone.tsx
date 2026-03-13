import { Link } from 'react-router';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { OneTimePhoneForm } from '../components/one-time-phone-form';

export default function OneTimePhonePage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Sign in with OTP</CardTitle>
          <CardDescription>
            Enter your phone number and we&apos;ll send you a one-time code
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OneTimePhoneForm />
        </CardContent>
      </Card>
    </div>
  );
}
