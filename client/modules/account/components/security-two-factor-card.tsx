import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import QRCode from 'qrcode';
import { Shield, ShieldCheck } from 'lucide-react';
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
import { Input } from '@/components/ui/input';

type EnableTotpFormData = {
  code: string;
};

export function SecurityTwoFactorCard({ user }: { user: AuthUser }) {
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

  const enableForm = useForm<EnableTotpFormData>({
    mode: 'onBlur',
    defaultValues: { code: '' },
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
            <div className="space-y-4">
              <h3 className="font-medium">Disable two-factor</h3>
              <p className="text-sm text-muted-foreground">
                You must have signed in recently to disable 2FA.
              </p>
              <Button
                type="button"
                variant="destructive"
                onClick={() =>
                  disable2FA.mutate(
                    {},
                    {
                      onSuccess: () => toast.success('2FA disabled'),
                      onError: (err) => toast.error(getAuthErrorMessage(err)),
                    },
                  )
                }
                disabled={disable2FA.isPending}
              >
                {disable2FA.isPending ? 'Disabling…' : 'Disable 2FA'}
              </Button>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium">Regenerate backup codes</h3>
              <p className="text-sm text-muted-foreground">
                Generate new backup codes. Old codes will no longer work. You
                must have signed in recently.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  generateBackupCodes.mutate(
                    {},
                    {
                      onSuccess: (data) => {
                        setGeneratedBackupCodes(data.backupCodes);
                        toast.success('Backup codes generated');
                      },
                      onError: (err) => toast.error(getAuthErrorMessage(err)),
                    },
                  )
                }
                disabled={generateBackupCodes.isPending}
              >
                {generateBackupCodes.isPending
                  ? 'Generating…'
                  : 'Generate backup codes'}
              </Button>
            </div>
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
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Click below to start 2FA setup. You must have signed in
                  recently.
                </p>
                <Button
                  type="button"
                  onClick={() =>
                    enable2FA.mutate(
                      {},
                      {
                        onSuccess: (data) => {
                          setTotpUri(data.totpURI);
                          setBackupCodes(data.backupCodes);
                        },
                        onError: (err) => toast.error(getAuthErrorMessage(err)),
                      },
                    )
                  }
                  disabled={enable2FA.isPending}
                >
                  {enable2FA.isPending ? 'Starting…' : 'Start 2FA setup'}
                </Button>
              </div>
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
                        {backupCodes.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
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
                    <Button type="submit" disabled={verifyEnableTotp.isPending}>
                      {verifyEnableTotp.isPending ? 'Verifying…' : 'Enable 2FA'}
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
