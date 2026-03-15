import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Phone } from 'lucide-react';
import { toast } from 'sonner';
import type { User as AuthUser } from '@/components/providers/auth-provider';
import {
  useUpdatePhoneMutation,
  useVerifyPhoneChangeMutation,
} from '../lib/query';
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

type PhoneFormData = {
  newPhone: string;
};

type VerifyOtpFormData = {
  code: string;
};

export function ProfilePhoneCard({ user }: { user: AuthUser }) {
  const [pendingPhoneVerification, setPendingPhoneVerification] =
    useState(false);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);

  const updatePhone = useUpdatePhoneMutation();
  const verifyPhoneChange = useVerifyPhoneChangeMutation();

  const phoneForm = useForm<PhoneFormData>({
    mode: 'onBlur',
    defaultValues: { newPhone: user?.phone ?? '' },
  });

  const verifyForm = useForm<VerifyOtpFormData>({
    mode: 'onBlur',
    defaultValues: { code: '' },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Phone</CardTitle>
        <CardDescription>
          Add or update your phone number for OTP sign-in and verification
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {user.phone && (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Phone className="size-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{user.phone}</p>
              {user.phoneVerified ? (
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
        )}
        {pendingPhoneVerification && pendingPhone ? (
          <form
            onSubmit={verifyForm.handleSubmit((data) =>
              verifyPhoneChange.mutate(
                { phone: pendingPhone, code: data.code },
                {
                  onSuccess: () => {
                    setPendingPhoneVerification(false);
                    setPendingPhone(null);
                    verifyForm.reset();
                    phoneForm.setValue('newPhone', pendingPhone);
                    toast.success('Phone number updated');
                  },
                  onError: (err) =>
                    verifyForm.setError('code', {
                      message: getAuthErrorMessage(err),
                    }),
                },
              ),
            )}
            noValidate
          >
            <FieldGroup>
              <Field data-invalid={!!verifyForm.formState.errors.code}>
                <FieldLabel htmlFor="phone-verify-code">
                  Verification code
                </FieldLabel>
                <Input
                  id="phone-verify-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  {...verifyForm.register('code', {
                    required: 'Code is required',
                    pattern: {
                      value: /^\d{6}$/,
                      message: 'Enter a 6-digit code',
                    },
                  })}
                />
                <FieldError>
                  {verifyForm.formState.errors.code?.message}
                </FieldError>
              </Field>
              <div className="flex gap-2">
                <Button type="submit" disabled={verifyPhoneChange.isPending}>
                  {verifyPhoneChange.isPending ? 'Verifying…' : 'Verify'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPendingPhoneVerification(false);
                    setPendingPhone(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </FieldGroup>
          </form>
        ) : (
          <form
            onSubmit={phoneForm.handleSubmit((data) =>
              updatePhone.mutate(
                { newPhone: data.newPhone },
                {
                  onSuccess: () => {
                    setPendingPhone(data.newPhone);
                    setPendingPhoneVerification(true);
                    toast.success('Verification code sent');
                  },
                  onError: (err) =>
                    phoneForm.setError('newPhone', {
                      message: getAuthErrorMessage(err),
                    }),
                },
              ),
            )}
            noValidate
          >
            <FieldGroup>
              <Field data-invalid={!!phoneForm.formState.errors.newPhone}>
                <FieldLabel htmlFor="phone-new">Phone number</FieldLabel>
                <Input
                  id="phone-new"
                  type="tel"
                  placeholder="+12345678900"
                  autoComplete="tel"
                  {...phoneForm.register('newPhone', {
                    required: 'Phone number is required',
                    pattern: {
                      value: /^\+[1-9]\d{10,14}$/,
                      message:
                        'Enter a valid E.164 phone number (e.g. +12345678900)',
                    },
                  })}
                />
                <FieldError>
                  {phoneForm.formState.errors.newPhone?.message}
                </FieldError>
              </Field>
              <Button type="submit" disabled={updatePhone.isPending}>
                {updatePhone.isPending
                  ? 'Sending…'
                  : user.phone
                    ? 'Send verification code'
                    : 'Add phone'}
              </Button>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
