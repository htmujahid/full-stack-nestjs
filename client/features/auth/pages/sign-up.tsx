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
import { SignUpForm } from '../components/sign-up-form';

export default function SignUpPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create an account</CardTitle>
          <CardDescription>Sign up with Google or your email</CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpForm />
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
