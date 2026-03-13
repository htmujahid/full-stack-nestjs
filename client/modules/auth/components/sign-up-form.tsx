import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { OAuthProviders } from './oauth-providers';
import { Spinner } from '@/components/ui/spinner';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

type SignUpFormData = {
  email: string;
  password: string;
};

export function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormData>({
    mode: 'onBlur',
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (data: SignUpFormData) => {
    startTransition(async () => {
      // TODO: wire to auth API with data
      void data;
      await new Promise((r) => setTimeout(r, 800));
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <OAuthProviders action="sign-up" disabled={isPending} />
        <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
          Or continue with
        </FieldSeparator>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="sign-up-email">Email</FieldLabel>
          <Input
            id="sign-up-email"
            type="email"
            placeholder="m@example.com"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'sign-up-email-error' : undefined}
            {...register('email', {
              required: 'Email is required',
              pattern: { value: EMAIL_RE, message: 'Please enter a valid email' },
            })}
          />
          <FieldError id="sign-up-email-error">{errors.email?.message}</FieldError>
        </Field>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="sign-up-password">Password</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="sign-up-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'sign-up-password-error' : undefined}
              {...register('password', {
                required: 'Password is required',
                minLength: {
                  value: MIN_PASSWORD_LENGTH,
                  message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
                },
              })}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowPassword((p) => !p)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <FieldError id="sign-up-password-error">{errors.password?.message}</FieldError>
        </Field>
        <Field>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Spinner aria-hidden />
                Creating account…
              </>
            ) : (
              'Sign up'
            )}
          </Button>
          <FieldDescription className="text-center">
            Already have an account?{' '}
            <Link to="/auth/sign-in">
              Sign in
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
