import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import QRCode from 'qrcode';
import { Eye, EyeOff, Shield, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { User as AuthUser } from '@/components/providers/auth-provider';
import {
  useEnable2FAMutation,
  useVerifyEnableTotpMutation,
  useDisable2FAMutation,
  useGenerateBackupCodesMutation,
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Input } from '@/components/ui/input';

type Enable2FAPasswordFormData = {
  password: string;
};

type EnableTotpFormData = {
  code: string;
};

type DisableTotpFormData = {
  password: string;
};

type BackupCodesFormData = {
  password: string;
};

export function SecurityTwoFactorCard({ user }: { user: AuthUser }) {
  const [showPassword, setShowPassword] = useState(false);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [generatedBackupCodes, setGeneratedBackupCodes] = useState<
    string[] | null
  >(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const enabled = user.twoFactorEnabled ?? false;
  const enable2FA = useEnable2FAMutation();
  const verifyEnableTotp = useVerifyEnableTotpMutation();
  const disable2FA = useDisable2FAMutation();
  const generateBackupCodes = useGenerateBackupCodesMutation();

  const enablePasswordForm = useForm<Enable2FAPasswordFormData>({
    mode: 'onBlur',
    defaultValues: { password: '' },
  });
  const enableForm = useForm<EnableTotpFormData>({
    mode: 'onBlur',
    defaultValues: { code: '' },
  });
  const disableForm = useForm<DisableTotpFormData>({
    mode: 'onBlur',
    defaultValues: { password: '' },
  });
  const backupForm = useForm<BackupCodesFormData>({
    mode: 'onBlur',
    defaultValues: { password: '' },
  });

  useEffect(() => {
    if (!totpUri) return;
    QRCode.toDataURL(totpUri, { width: 192, margin: 1 }).then(setQrDataUrl);
  }, [totpUri]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Two-factor authentication</CardTitle>
            <CardDescription>
              {enabled
                ? 'Two-factor authentication is enabled'
                : 'Two-factor authentication is not enabled'}
            </CardDescription>
          </div>
          <Badge variant={enabled ? 'default' : 'outline'}>
            {enabled ? (
              <>
                <ShieldCheck className="size-3" />
                Enabled
              </>
            ) : (
              <>
                <Shield className="size-3" />
                Disabled
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {enabled ? (
          <>
            <form
              onSubmit={disableForm.handleSubmit((data) =>
                disable2FA.mutate(
                  { password: data.password },
                  {
                    onSuccess: () => {
                      disableForm.reset();
                      toast.success('2FA disabled');
                    },
                    onError: (err) =>
                      disableForm.setError('password', {
                        message: getAuthErrorMessage(err),
                      }),
                  },
                ),
              )}
              noValidate
              className="space-y-4"
            >
              <h3 className="font-medium">Disable two-factor</h3>
              <FieldGroup>
                <Field data-invalid={!!disableForm.formState.errors.password}>
                  <FieldLabel htmlFor="2fa-disable-password">
                    Confirm your password
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="2fa-disable-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      {...disableForm.register('password', {
                        required: 'Password is required',
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
                  <FieldError>
                    {disableForm.formState.errors.password?.message}
                  </FieldError>
                </Field>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={disable2FA.isPending}
                >
                  {disable2FA.isPending ? 'Disabling…' : 'Disable 2FA'}
                </Button>
              </FieldGroup>
            </form>

            <form
              onSubmit={backupForm.handleSubmit((data) =>
                generateBackupCodes.mutate(
                  { password: data.password },
                  {
                    onSuccess: (data) => {
                      backupForm.reset();
                      setGeneratedBackupCodes(data.backupCodes);
                      toast.success('Backup codes generated');
                    },
                    onError: (err) =>
                      backupForm.setError('password', {
                        message: getAuthErrorMessage(err),
                      }),
                  },
                ),
              )}
              noValidate
              className="space-y-4"
            >
              <h3 className="font-medium">Regenerate backup codes</h3>
              <p className="text-sm text-muted-foreground">
                Generate new backup codes. Old codes will no longer work.
              </p>
              <FieldGroup>
                <Field data-invalid={!!backupForm.formState.errors.password}>
                  <FieldLabel htmlFor="2fa-backup-password">
                    Confirm your password
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="2fa-backup-password"
                      type="password"
                      autoComplete="current-password"
                      {...backupForm.register('password', {
                        required: 'Password is required',
                      })}
                    />
                  </InputGroup>
                  <FieldError>
                    {backupForm.formState.errors.password?.message}
                  </FieldError>
                </Field>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={generateBackupCodes.isPending}
                >
                  {generateBackupCodes.isPending
                    ? 'Generating…'
                    : 'Generate backup codes'}
                </Button>
              </FieldGroup>
            </form>
            {generatedBackupCodes && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium">
                  Save these backup codes securely
                </h3>
                <ul className="grid list-inside list-disc gap-1 font-mono text-sm">
                  {generatedBackupCodes.map((code, i) => (
                    <li key={i}>{code}</li>
                  ))}
                </ul>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => setGeneratedBackupCodes(null)}
                >
                  Dismiss
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <h3 className="font-medium">Enable two-factor</h3>
            {!totpUri ? (
              <form
                onSubmit={enablePasswordForm.handleSubmit((data) =>
                  enable2FA.mutate(
                    { password: data.password },
                    {
                      onSuccess: (data) => {
                        setTotpUri(data.totpURI);
                        setBackupCodes(data.backupCodes);
                        enablePasswordForm.reset();
                      },
                      onError: (err) =>
                        enablePasswordForm.setError('password', {
                          message: getAuthErrorMessage(err),
                        }),
                    },
                  ),
                )}
                noValidate
              >
                <p className="mb-4 text-sm text-muted-foreground">
                  Enter your password to start 2FA setup.
                </p>
                <FieldGroup>
                  <Field
                    data-invalid={
                      !!enablePasswordForm.formState.errors.password
                    }
                  >
                    <FieldLabel htmlFor="2fa-password">Password</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="2fa-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        {...enablePasswordForm.register('password', {
                          required: 'Password is required',
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
                    <FieldError>
                      {
                        enablePasswordForm.formState.errors.password
                          ?.message
                      }
                    </FieldError>
                  </Field>
                  <Button type="submit" disabled={enable2FA.isPending}>
                    {enable2FA.isPending ? 'Starting…' : 'Start 2FA setup'}
                  </Button>
                </FieldGroup>
              </form>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Scan the QR code with your authenticator app, then enter the
                  6-digit code to verify.
                </p>
                <div className="flex flex-col items-start gap-4">
                  {qrDataUrl && (
                    <img
                      src={qrDataUrl}
                      alt="TOTP QR code"
                      className="rounded-lg border"
                    />
                  )}
                  {backupCodes && (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Backup codes (save these)
                      </p>
                      <ul className="grid list-inside list-disc gap-1 font-mono text-xs">
                        {backupCodes.slice(0, 5).map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                        {backupCodes.length > 5 && (
                          <li className="text-muted-foreground">
                            …and {backupCodes.length - 5} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
                <form
                  onSubmit={enableForm.handleSubmit((data) =>
                    verifyEnableTotp.mutate(
                      { code: data.code },
                      {
                        onSuccess: () => {
                          setTotpUri(null);
                          setBackupCodes(null);
                          setQrDataUrl(null);
                          toast.success('2FA enabled');
                        },
                        onError: (err) =>
                          enableForm.setError('code', {
                            message: getAuthErrorMessage(err),
                          }),
                      },
                    ),
                  )}
                  noValidate
                >
                  <FieldGroup>
                    <Field data-invalid={!!enableForm.formState.errors.code}>
                      <FieldLabel htmlFor="2fa-enable-code">
                        Verification code
                      </FieldLabel>
                      <Input
                        id="2fa-enable-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="000000"
                        maxLength={6}
                        {...enableForm.register('code', {
                          required: 'Code is required',
                          pattern: {
                            value: /^\d{6}$/,
                            message: 'Enter a 6-digit code',
                          },
                        })}
                      />
                      <FieldError>
                        {enableForm.formState.errors.code?.message}
                      </FieldError>
                    </Field>
                    <Button
                      type="submit"
                      disabled={verifyEnableTotp.isPending}
                    >
                      {verifyEnableTotp.isPending
                        ? 'Verifying…'
                        : 'Enable 2FA'}
                    </Button>
                  </FieldGroup>
                </form>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
