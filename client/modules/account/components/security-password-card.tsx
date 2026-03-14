import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAccountsQuery, useUpdatePasswordMutation } from '../lib/query';
import { getAuthErrorMessage } from '@/modules/auth/lib/query';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
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

const MIN_PASSWORD_LENGTH = 8;

type PasswordFormData = {
  newPassword: string;
  confirmPassword: string;
};

export function SecurityPasswordCard() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: accounts = [] } = useAccountsQuery();
  const hasCredential = accounts.some((a) => a.providerId === 'credential');
  const updatePassword = useUpdatePasswordMutation();
  const form = useForm<PasswordFormData>({
    mode: 'onBlur',
    defaultValues: { newPassword: '', confirmPassword: '' },
  });
  const password = form.watch('newPassword');

  if (!hasCredential) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>
          Change your password. You will need to re-authenticate first.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit((data) =>
            updatePassword.mutate(
              { newPassword: data.newPassword },
              {
                onSuccess: () => {
                  form.reset();
                  toast.success('Password updated');
                },
                onError: (err) =>
                  form.setError('root', {
                    message: getAuthErrorMessage(err),
                  }),
              },
            ),
          )}
          noValidate
        >
          <FieldGroup>
            {form.formState.errors.root?.message && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {form.formState.errors.root.message}
              </div>
            )}
            <Field data-invalid={!!form.formState.errors.newPassword}>
              <FieldLabel htmlFor="password-new">New password</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="password-new"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  aria-invalid={!!form.formState.errors.newPassword}
                  aria-describedby={
                    form.formState.errors.newPassword
                      ? 'password-new-error'
                      : undefined
                  }
                  {...form.register('newPassword', {
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
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldError id="password-new-error">
                {form.formState.errors.newPassword?.message}
              </FieldError>
            </Field>
            <Field
              data-invalid={!!form.formState.errors.confirmPassword}
            >
              <FieldLabel htmlFor="password-confirm">
                Confirm password
              </FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="password-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  aria-invalid={
                    !!form.formState.errors.confirmPassword
                  }
                  aria-describedby={
                    form.formState.errors.confirmPassword
                      ? 'password-confirm-error'
                      : undefined
                  }
                  {...form.register('confirmPassword', {
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
                    aria-label={
                      showConfirm ? 'Hide password' : 'Show password'
                    }
                  >
                    {showConfirm ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldError id="password-confirm-error">
                {form.formState.errors.confirmPassword?.message}
              </FieldError>
            </Field>
            <Button
              type="submit"
              disabled={updatePassword.isPending}
            >
              {updatePassword.isPending ? 'Updating…' : 'Update password'}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
