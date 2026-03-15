import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useSignInPhoneMutation, getAuthErrorMessage } from '../lib/query';
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

type OneTimePhoneFormData = { phone: string };

export function OneTimePhoneForm() {
  const navigate = useNavigate();
  const signInPhone = useSignInPhoneMutation();

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<OneTimePhoneFormData>({
    mode: 'onBlur',
    defaultValues: { phone: '' },
  });

  const onSendOtp = (data: OneTimePhoneFormData) => {
    clearErrors('root');
    signInPhone.mutate(
      {
        phone: data.phone,
        callbackURL: `${window.location.origin}${paths.home}`,
      },
      {
        onSuccess: () => {
          toast.success('Check your phone', {
            description: "If an account exists, you'll receive an OTP code.",
          });
          navigate(
            `${paths.auth.oneTimeVerify}?phone=${encodeURIComponent(data.phone)}`,
            {
              replace: true,
            },
          );
        },
        onError: (e) => setError('root', { message: getAuthErrorMessage(e) }),
      },
    );
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSendOtp)} noValidate>
        <FieldGroup>
          {errors.root?.message && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errors.root.message}
            </div>
          )}
          <Field data-invalid={!!errors.phone}>
            <FieldLabel htmlFor="one-time-phone">Phone number</FieldLabel>
            <Input
              id="one-time-phone"
              type="tel"
              placeholder="+12345678900"
              autoComplete="tel"
              aria-invalid={!!errors.phone}
              aria-describedby={
                errors.phone ? 'one-time-phone-error' : undefined
              }
              {...register('phone', {
                required: 'Phone number is required',
              })}
            />
            <FieldError id="one-time-phone-error">
              {errors.phone?.message}
            </FieldError>
          </Field>
          <Button type="submit" disabled={signInPhone.isPending}>
            {signInPhone.isPending ? (
              <>
                <Spinner aria-hidden />
                Sending code…
              </>
            ) : (
              'Send OTP'
            )}
          </Button>
        </FieldGroup>
      </form>
      <div className="mt-4 flex flex-col gap-3">
        <FieldDescription className="text-center">
          Prefer magic link?{' '}
          <Link to={paths.auth.magicLink}>Sign in with email</Link>
        </FieldDescription>
        <FieldDescription className="text-center">
          <Link to={paths.auth.signIn}>Back to sign in</Link>
        </FieldDescription>
      </div>
    </>
  );
}
