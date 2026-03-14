import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  useVerifyTotpMutation,
  useVerifyBackupCodeMutation,
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { Spinner } from '@/components/ui/spinner';
import { paths } from '@/config/paths.config';
import { cn } from '@/lib/utils';

const TOTP_LENGTH = 6;
const BACKUP_CODE_RE = /^[a-zA-Z0-9]{5}-[a-zA-Z0-9]{5}$/;

type Mode = 'totp' | 'backup';

export function TwoFactorForm() {
  const [mode, setMode] = useState<Mode>('totp');
  const [totp, setTotp] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const verifyTotp = useVerifyTotpMutation();
  const verifyBackup = useVerifyBackupCodeMutation();
  const sendOtp = useSendTwoFactorOtpMutation();

  const onSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    navigate(paths.home, { replace: true });
  };

  const onError = (e: unknown) => {
    if (isUnauthorized(e)) {
      navigate(paths.auth.signIn, { replace: true });
      return;
    }
    setError(getAuthErrorMessage(e));
  };

  const handleTotpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (totp.length !== TOTP_LENGTH) return;
    verifyTotp.mutate(
      { code: totp, trustDevice },
      { onSuccess, onError },
    );
  };

  const handleBackupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = backupCode.trim();
    if (!BACKUP_CODE_RE.test(trimmed)) {
      setError('Code must be in XXXXX-XXXXX format');
      return;
    }
    verifyBackup.mutate(
      { code: trimmed, trustDevice },
      { onSuccess, onError },
    );
  };

  const handleSendOtp = (e: React.MouseEvent) => {
    e.preventDefault();
    setError(null);
    sendOtp.mutate(undefined, {
      onSuccess: () => {
        toast.success('Code sent', {
          description: 'Check your email for the verification code.',
        });
        navigate(paths.auth.twoFactorOtp, { replace: true });
      },
      onError,
    });
  };

  const totpPending = verifyTotp.isPending;
  const backupPending = verifyBackup.isPending;
  const sendOtpPending = sendOtp.isPending;
  const isPending = totpPending || backupPending || sendOtpPending;

  return (
    <>
      <form
        onSubmit={mode === 'totp' ? handleTotpSubmit : handleBackupSubmit}
        noValidate
      >
        <FieldGroup>
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {mode === 'totp' ? (
            <>
              <Field>
                <FieldLabel>Authenticator code</FieldLabel>
                <InputOTP
                  maxLength={TOTP_LENGTH}
                  value={totp}
                  onChange={setTotp}
                  aria-invalid={!!error}
                >
                  <InputOTPGroup className="w-min mx-auto">
                    {Array.from({ length: TOTP_LENGTH }).map((_, i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <FieldDescription>
                  Enter the 6-digit code from your authenticator app
                </FieldDescription>
              </Field>
            </>
          ) : (
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="two-factor-backup">Backup code</FieldLabel>
              <Input
                id="two-factor-backup"
                type="text"
                placeholder="XXXXX-XXXXX"
                autoComplete="one-time-code"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                aria-invalid={!!error}
                className="font-mono tracking-wider"
              />
              <FieldError>
                {backupCode && !BACKUP_CODE_RE.test(backupCode.trim())
                  ? 'Code must be in XXXXX-XXXXX format'
                  : null}
              </FieldError>
            </Field>
          )}

          <Field orientation="horizontal" className="items-center gap-2">
            <Checkbox
              id="two-factor-trust"
              checked={trustDevice}
              onCheckedChange={(v) => setTrustDevice(v === true)}
              aria-describedby="two-factor-trust-desc"
            />
            <FieldLabel
              id="two-factor-trust-desc"
              htmlFor="two-factor-trust"
              className="cursor-pointer font-normal"
            >
              Trust this device for 30 days
            </FieldLabel>
          </Field>

          <Field>
            <Button
              type="submit"
              disabled={
                isPending ||
                (mode === 'totp' ? totp.length !== TOTP_LENGTH : !BACKUP_CODE_RE.test(backupCode.trim()))
              }
            >
              {totpPending || backupPending ? (
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
          {mode === 'totp' ? (
            <button
              type="button"
              onClick={() => setMode('backup')}
              className="underline-offset-4 hover:underline"
            >
              Use a backup code instead
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMode('totp')}
              className="underline-offset-4 hover:underline"
            >
              Use authenticator app instead
            </button>
          )}
        </FieldDescription>
        <FieldDescription className="text-center">
          <button
            type="button"
            onClick={handleSendOtp}
            disabled={sendOtpPending}
            className={cn(
              'underline-offset-4 hover:underline',
              sendOtpPending && 'opacity-50 cursor-not-allowed',
            )}
          >
            {sendOtpPending ? (
              <>
                <Spinner className="inline size-3.5 mr-1" aria-hidden />
                Sending…
              </>
            ) : (
              'Send code to my email instead'
            )}
          </button>
        </FieldDescription>
        <FieldDescription className="text-center">
          <Link to={paths.auth.signIn}>Back to sign in</Link>
        </FieldDescription>
      </div>
    </>
  );
}
