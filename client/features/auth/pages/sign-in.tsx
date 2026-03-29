import { Link } from 'react-router';
import { paths } from '@/config/paths.config';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FieldDescription } from '@/components/ui/field';
import { SignInForm } from '../components/sign-in-form';

export default function SignInPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>Sign in with Google or your email</CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm />
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
