import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { useSignInEmailMutation, getAuthErrorMessage } from '../lib/query';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { paths } from '@/config/paths.config';
import { Spinner } from '@/components/ui/spinner';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type MagicLinkFormData = { email: string };

export function MagicLinkForm() {
  const signInEmail = useSignInEmailMutation();
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<MagicLinkFormData>({
    mode: 'onBlur',
    defaultValues: { email: '' },
  });

  const onSubmit = (data: MagicLinkFormData) => {
    clearErrors('root');
    const origin = window.location.origin;
    signInEmail.mutate(
      {
        email: data.email,
        callbackURL: `${origin}${paths.home}`,
        errorURL: `${origin}${paths.auth.error}`,
      },
      {
        onSuccess: () =>
          toast.success('Check your email', {
            description: "If an account exists, you'll receive a sign-in link.",
          }),
        onError: (e) => setError('root', { message: getAuthErrorMessage(e) }),
      },
    );
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
        {errors.root?.message && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errors.root.message}
          </div>
        )}
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="magic-link-email">Email</FieldLabel>
          <Input
            id="magic-link-email"
            type="email"
            placeholder="m@example.com"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={
              errors.email ? 'magic-link-email-error' : undefined
            }
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: EMAIL_RE,
                message: 'Please enter a valid email',
              },
            })}
          />
          <FieldError id="magic-link-email-error">
            {errors.email?.message}
          </FieldError>
        </Field>
        <Button type="submit" disabled={signInEmail.isPending}>
          {signInEmail.isPending ? (
            <>
              <Spinner aria-hidden />
              Sending link…
            </>
          ) : (
            'Send magic link'
          )}
        </Button>
        </FieldGroup>
      </form>
      <div className="mt-4 flex flex-col gap-3">
        <FieldDescription className="text-center">
          Prefer OTP? <Link to={paths.auth.oneTimePhone}>Sign in with phone</Link>
        </FieldDescription>
        <FieldDescription className="text-center">
          <Link to={paths.auth.signIn}>Back to sign in</Link>
        </FieldDescription>
      </div>
    </>
  );
}
