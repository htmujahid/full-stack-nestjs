import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSignInMutation, getAuthErrorMessage } from '../lib/query';
import { ME_QUERY_KEY } from '@/components/providers/auth-provider';
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

type SignInFormData = {
  identifier: string;
  password: string;
};

export function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signIn = useSignInMutation();

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<SignInFormData>({
    mode: 'onBlur',
    defaultValues: { identifier: '', password: '' },
  });

  const onSubmit = (data: SignInFormData) => {
    clearErrors('root');
    signIn.mutate(
      {
        identifier: data.identifier,
        password: data.password,
        rememberMe: true,
      },
      {
        onSuccess: (res) => {
          if ('twoFactorRedirect' in res) {
            navigate('/auth/two-factor', { replace: true });
            return;
          }
          void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
          navigate('/home', { replace: true });
        },
        onError: (e) => setError('root', { message: getAuthErrorMessage(e) }),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <OAuthProviders action="sign-in" disabled={signIn.isPending} />
        <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
          Or continue with
        </FieldSeparator>
        {errors.root?.message && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errors.root.message}
          </div>
        )}
        <Field data-invalid={!!errors.identifier}>
          <FieldLabel htmlFor="sign-in-identifier">Email, username, or phone</FieldLabel>
          <Input
            id="sign-in-identifier"
            type="text"
            placeholder="Email, username, or phone"
            autoComplete="username"
            aria-invalid={!!errors.identifier}
            aria-describedby={errors.identifier ? 'sign-in-identifier-error' : undefined}
            {...register('identifier', { required: 'Email, username, or phone is required' })}
          />
          <FieldError id="sign-in-identifier-error">{errors.identifier?.message}</FieldError>
        </Field>
        <Field data-invalid={!!errors.password}>
          <div className="flex items-center">
            <FieldLabel htmlFor="sign-in-password">
              Password
            </FieldLabel>
            <Link
              to="/auth/forgot-password"
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <InputGroup>
            <InputGroupInput
              id="sign-in-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'sign-in-password-error' : undefined}
              {...register('password', { required: 'Password is required' })}
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
          <FieldError id="sign-in-password-error">{errors.password?.message}</FieldError>
        </Field>
        <Field>
          <Button type="submit" disabled={signIn.isPending}>
            {signIn.isPending ? (
              <>
                <Spinner aria-hidden />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </Button>
          <FieldDescription className="text-center">
            Don&apos;t have an account?{' '}
            <Link to="/auth/sign-up">
              Sign up
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
