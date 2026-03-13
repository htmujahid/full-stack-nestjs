import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
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
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    mode: 'onBlur',
    defaultValues: { email: '' },
  });

  const onSubmit = (data: ForgotPasswordFormData) => {
    startTransition(async () => {
      // TODO: wire to auth API with data
      void data;
      await new Promise((r) => setTimeout(r, 800));
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
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
          <Button type="submit" disabled={isPending}>
            {isPending ? (
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
