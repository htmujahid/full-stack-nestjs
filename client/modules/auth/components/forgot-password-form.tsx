import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { useForgotPasswordMutation, getAuthErrorMessage } from '../lib/query';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ForgotPasswordFormData = {
  email: string;
};

export function ForgotPasswordForm() {
  const [success, setSuccess] = useState(false);
  const forgotPassword = useForgotPasswordMutation();

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    mode: 'onBlur',
    defaultValues: { email: '' },
  });

  const onSubmit = (data: ForgotPasswordFormData) => {
    clearErrors('root');
    forgotPassword.mutate(
      {
        email: data.email,
        callbackURL: `${window.location.origin}/auth/reset-password`,
      },
      {
        onSuccess: () => setSuccess(true),
        onError: (e) => setError('root', { message: getAuthErrorMessage(e) }),
      },
    );
  };

  if (success) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Check your email for a link to reset your password.
        </p>
        <Link to="/auth/sign-in" className="text-sm text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {errors.root?.message && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errors.root.message}
          </div>
        )}
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="forgot-email">Email</FieldLabel>
          <Input
            id="forgot-email"
            type="email"
            placeholder="m@example.com"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'forgot-email-error' : undefined}
            {...register('email', {
              required: 'Email is required',
              pattern: { value: EMAIL_RE, message: 'Please enter a valid email' },
            })}
          />
          <FieldError id="forgot-email-error">{errors.email?.message}</FieldError>
        </Field>
        <Field>
          <Button type="submit" disabled={forgotPassword.isPending}>
            {forgotPassword.isPending ? (
              <>
                <Spinner aria-hidden />
                Sending…
              </>
            ) : (
              'Send reset link'
            )}
          </Button>
          <FieldDescription className="text-center">
            Remember your password?{' '}
            <Link to="/auth/sign-in">Sign in</Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
