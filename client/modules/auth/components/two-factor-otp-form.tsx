import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  useVerifyOtpMutation,
  useSendTwoFactorOtpMutation,
  getAuthErrorMessage,
  isUnauthorized,
} from '../lib/query';
import { ME_QUERY_KEY } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Spinner } from '@/components/ui/spinner';
import { paths } from '@/config/paths.config';
import { toast } from 'sonner';

const OTP_LENGTH = 6;

export function TwoFactorOtpForm() {
  const [otp, setOtp] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const verifyOtp = useVerifyOtpMutation();
  const sendOtp = useSendTwoFactorOtpMutation();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (otp.length !== OTP_LENGTH) return;
    verifyOtp.mutate(
      { code: otp, trustDevice },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
          navigate(paths.home, { replace: true });
        },
        onError: (e) => {
          if (isUnauthorized(e)) {
            navigate(paths.auth.signIn, { replace: true });
            return;
          }
          setError(getAuthErrorMessage(e));
        },
      },
    );
  };

  const handleResend = (e: React.MouseEvent) => {
    e.preventDefault();
    setError(null);
    sendOtp.mutate(undefined, {
      onSuccess: () =>
        toast.success('Code sent', {
          description: 'Check your email for a new verification code.',
        }),
      onError: (e) => {
        if (isUnauthorized(e)) {
          navigate(paths.auth.signIn, { replace: true });
          return;
        }
        setError(getAuthErrorMessage(e));
      },
    });
  };

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
            <FieldLabel>Email verification code</FieldLabel>
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
            <FieldDescription>
              Enter the 6-digit code we sent to your email
            </FieldDescription>
          </Field>
          <Field orientation="horizontal" className="items-center gap-2">
            <Checkbox
              id="two-factor-otp-trust"
              checked={trustDevice}
              onCheckedChange={(v) => setTrustDevice(v === true)}
              aria-describedby="two-factor-otp-trust-desc"
            />
            <FieldLabel
              id="two-factor-otp-trust-desc"
              htmlFor="two-factor-otp-trust"
              className="cursor-pointer font-normal"
            >
              Trust this device for 30 days
            </FieldLabel>
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
                'Continue'
              )}
            </Button>
          </Field>
        </FieldGroup>
      </form>
      <div className="mt-4 flex flex-col gap-3">
        <FieldDescription className="text-center">
          <button
            type="button"
            onClick={handleResend}
            disabled={sendOtp.isPending}
            className="underline-offset-4 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendOtp.isPending ? (
              <>
                <Spinner className="inline size-3.5 mr-1" aria-hidden />
                Sending…
              </>
            ) : (
              'Resend code'
            )}
          </button>
        </FieldDescription>
        <FieldDescription className="text-center">
          <Link to={paths.auth.twoFactor}>Use authenticator or backup code</Link>
        </FieldDescription>
        <FieldDescription className="text-center">
          <Link to={paths.auth.signIn}>Back to sign in</Link>
        </FieldDescription>
      </div>
    </>
  );
}
