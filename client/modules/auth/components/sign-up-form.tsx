import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useSignUpMutation, getAuthErrorMessage } from '../lib/query';
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
const USERNAME_RE = /^[a-zA-Z0-9_-]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 30;

type SignUpFormData = {
  username: string;
  email: string;
  password: string;
};

export function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const signUp = useSignUpMutation();

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<SignUpFormData>({
    mode: 'onBlur',
    defaultValues: { username: '', email: '', password: '' },
  });

  const onSubmit = (data: SignUpFormData) => {
    clearErrors('root');
    signUp.mutate(
      {
        name: data.username,
        username: data.username,
        email: data.email,
        password: data.password,
        callbackURL: '/home'
      },
      {
        onSuccess: () => {
          toast.success('Verification email sent', {
            description: 'Check your inbox and verify your email address.',
          });
          navigate('/auth/sign-in', { replace: true });
        },
        onError: (e) => setError('root', { message: getAuthErrorMessage(e) }),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <OAuthProviders action="sign-up" disabled={signUp.isPending} />
        <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
          Or continue with
        </FieldSeparator>
        {errors.root?.message && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errors.root.message}
          </div>
        )}
        <Field data-invalid={!!errors.username}>
          <FieldLabel htmlFor="sign-up-username">Username</FieldLabel>
          <Input
            id="sign-up-username"
            type="text"
            placeholder="username"
            autoComplete="username"
            aria-invalid={!!errors.username}
            aria-describedby={errors.username ? 'sign-up-username-error' : undefined}
            {...register('username', {
              required: 'Username is required',
              minLength: { value: MIN_USERNAME_LENGTH, message: `At least ${MIN_USERNAME_LENGTH} characters` },
              maxLength: { value: MAX_USERNAME_LENGTH, message: `At most ${MAX_USERNAME_LENGTH} characters` },
              pattern: { value: USERNAME_RE, message: 'Letters, numbers, underscores, hyphens only' },
            })}
          />
          <FieldError id="sign-up-username-error">{errors.username?.message}</FieldError>
        </Field>
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
          <Button type="submit" disabled={signUp.isPending}>
            {signUp.isPending ? (
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
