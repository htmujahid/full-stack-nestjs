import { Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { User as AuthUser } from '@/components/providers/auth-provider';
import { useUpdateEmailMutation } from '../lib/query';
import { getAuthErrorMessage } from '@/modules/auth/lib/query';
import { Badge } from '@/components/ui/badge';
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
import { Input } from '@/components/ui/input';

type EmailFormData = {
  newEmail: string;
};

export function ProfileEmailCard({ user }: { user: AuthUser }) {
  const updateEmail = useUpdateEmailMutation();
  const form = useForm<EmailFormData>({
    mode: 'onBlur',
    defaultValues: { newEmail: user?.email ?? '' },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email</CardTitle>
        <CardDescription>
          Update your email address. You will need to verify the new address.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Mail className="size-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{user.email}</p>
            {user.emailVerified ? (
              <Badge variant="secondary" className="mt-1">
                Verified
              </Badge>
            ) : (
              <Badge variant="outline" className="mt-1">
                Unverified
              </Badge>
            )}
          </div>
        </div>
        <form
          onSubmit={form.handleSubmit((data) =>
            updateEmail.mutate(
              {
                newEmail: data.newEmail,
                callbackURL: `${window.location.origin}/account/profile`,
                errorURL: `${window.location.origin}/account/profile?error=email`,
              },
              {
                onSuccess: () => {
                  form.setValue('newEmail', '', { shouldDirty: false });
                  toast.success('Verification email sent');
                },
                onError: (err) =>
                  form.setError('newEmail', {
                    message: getAuthErrorMessage(err),
                  }),
              },
            ),
          )}
          noValidate
        >
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.newEmail}>
              <FieldLabel htmlFor="email-new">New email address</FieldLabel>
              <Input
                id="email-new"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={!!form.formState.errors.newEmail}
                aria-describedby={
                  form.formState.errors.newEmail ? 'email-new-error' : undefined
                }
                {...form.register('newEmail', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Enter a valid email address',
                  },
                })}
              />
              <FieldError id="email-new-error">
                {form.formState.errors.newEmail?.message}
              </FieldError>
            </Field>
            <Button type="submit" disabled={updateEmail.isPending}>
              {updateEmail.isPending ? 'Sending…' : 'Send verification email'}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
