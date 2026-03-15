import { Link, useSearchParams } from 'react-router';
import { paths } from '@/config/paths.config';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FieldDescription } from '@/components/ui/field';
import { ResetPasswordForm } from '../components/reset-password-form';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Reset password</CardTitle>
          <CardDescription>Enter your new password below</CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm token={token} />
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our{' '}
        <Link to={paths.terms}>Terms of Service</Link> and{' '}
        <Link to={paths.privacy}>Privacy Policy</Link>.
      </FieldDescription>
    </div>
  );
}
