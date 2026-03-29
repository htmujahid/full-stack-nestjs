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
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_TOKEN: 'This link has expired or is invalid. Request a new one.',
  EXPIRED: 'This link has expired. Request a new one.',
  DEFAULT: 'Something went wrong. Please try again.',
};

export default function AuthErrorPage() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('error') ?? 'DEFAULT';
  const message = ERROR_MESSAGES[code] ?? ERROR_MESSAGES.DEFAULT;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="size-6" aria-hidden />
          </div>
          <CardTitle className="text-xl">Authentication error</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Link
            to={paths.auth.signIn}
            className={cn(buttonVariants({ variant: 'default' }))}
          >
            Sign in
          </Link>
          <FieldDescription className="text-center">
            <Link
              to={paths.auth.forgotPassword}
              className="underline hover:no-underline"
            >
              Forgot password?
            </Link>
          </FieldDescription>
        </CardContent>
      </Card>
    </div>
  );
}
