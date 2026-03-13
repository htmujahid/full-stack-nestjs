import { Link } from 'react-router';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FieldDescription } from '@/components/ui/field';
import { ForgotPasswordForm } from '../components/forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Forgot password</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our{' '}
        <Link to="/terms">Terms of Service</Link> and{' '}
        <Link to="/privacy">Privacy Policy</Link>
        .
      </FieldDescription>
    </div>
  );
}
