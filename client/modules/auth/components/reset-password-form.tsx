import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useResetPasswordMutation, getAuthErrorMessage } from '../lib/query';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { paths } from '@/config/paths.config';
import { Spinner } from '@/components/ui/spinner';

const MIN_PASSWORD_LENGTH = 8;

type ResetPasswordFormData = {
  password: string;
  confirmPassword: string;
};

type ResetPasswordFormProps = {
  token: string | null;
};

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();
  const resetPassword = useResetPasswordMutation();

  const {
    register,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    mode: 'onBlur',
    defaultValues: { password: '', confirmPassword: '' },
  });

  const password = watch('password');

  const onSubmit = (data: ResetPasswordFormData) => {
    if (!token) return;
    clearErrors('root');
    resetPassword.mutate(
      { token, newPassword: data.password },
      {
        onSuccess: () => {
          toast.success('Password reset successful');
          navigate(paths.auth.signIn, { replace: true });
        },
        onError: (e) => setError('root', { message: getAuthErrorMessage(e) }),
      },
    );
  };

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Invalid or expired reset link. Please request a new one.
        </p>
        <Link to={paths.auth.forgotPassword} className={buttonVariants()}>
          Request new link
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
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="reset-password">New password</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="reset-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'reset-password-error' : undefined}
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
          <FieldError id="reset-password-error">{errors.password?.message}</FieldError>
        </Field>
        <Field data-invalid={!!errors.confirmPassword}>
          <FieldLabel htmlFor="reset-confirm-password">Confirm password</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="reset-confirm-password"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={
                errors.confirmPassword ? 'reset-confirm-password-error' : undefined
              }
              {...register('confirmPassword', {
                required: 'Please confirm your password',
                validate: (value) =>
                  value === password || 'Passwords do not match',
              })}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowConfirm((p) => !p)}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <FieldError id="reset-confirm-password-error">
            {errors.confirmPassword?.message}
          </FieldError>
        </Field>
        <Field>
          <Button type="submit" disabled={resetPassword.isPending}>
            {resetPassword.isPending ? (
              <>
                <Spinner aria-hidden />
                Resetting…
              </>
            ) : (
              'Reset password'
            )}
          </Button>
          <FieldDescription className="text-center">
            Remember your password?{' '}
            <Link to={paths.auth.signIn}>Sign in</Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
