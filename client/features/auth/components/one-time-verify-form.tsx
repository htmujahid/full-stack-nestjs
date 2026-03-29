import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useVerifyPhoneOtpMutation, getAuthErrorMessage } from '../lib/query';
import { ME_QUERY_KEY } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { paths } from '@/config/paths.config';
import { Spinner } from '@/components/ui/spinner';

const OTP_LENGTH = 6;

export function OneTimeVerifyForm() {
  const [searchParams] = useSearchParams();
  const phone = searchParams.get('phone') ?? '';
  const [otp, setOtp] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const verifyOtp = useVerifyPhoneOtpMutation();

  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phone) {
      setError('Phone number is missing. Go back and try again.');
      return;
    }
    if (otp.length !== OTP_LENGTH) return;
    verifyOtp.mutate(
      {
        phone,
        code: otp,
        rememberMe: true,
        callbackURL: `${window.location.origin}${paths.home}`,
      },
      {
        onSuccess: (res) => {
          if ('twoFactorRedirect' in res) {
            navigate(paths.auth.twoFactor, { replace: true });
            return;
          }
          void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
          navigate(paths.home, { replace: true });
        },
        onError: (e) => setError(getAuthErrorMessage(e)),
      },
    );
  };

  if (!phone) {
    return (
      <FieldGroup>
        <p className="text-sm text-muted-foreground">
          Phone number is required to verify. Please go back and enter your
          phone number.
        </p>
        <Button variant="outline">
          <Link to={paths.auth.oneTimePhone}>Back to OTP</Link>
        </Button>
      </FieldGroup>
    );
  }

  return (
    <>
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <Field>
            <FieldLabel>Enter the 6-digit code sent to {phone}</FieldLabel>
            <InputOTP
              maxLength={OTP_LENGTH}
              value={otp}
              onChange={setOtp}
              aria-invalid={!!error}
            >
              <InputOTPGroup className="w-min mx-auto">
                {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </Field>
          <Field>
            <Button
              type="submit"
              disabled={verifyOtp.isPending || otp.length !== OTP_LENGTH}
            >
              {verifyOtp.isPending ? (
                <>
                  <Spinner aria-hidden />
                  Verifying…
                </>
              ) : (
                'Verify and sign in'
              )}
            </Button>
          </Field>
        </FieldGroup>
      </form>
      <div className="mt-4 flex flex-col gap-3">
        <FieldDescription className="text-center">
          <Link to={paths.auth.oneTimePhone}>Use a different number</Link>
        </FieldDescription>
        <FieldDescription className="text-center">
          <Link to={paths.auth.signIn}>Back to sign in</Link>
        </FieldDescription>
      </div>
    </>
  );
}
