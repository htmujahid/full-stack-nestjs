import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { User as AuthUser } from '@/components/providers/auth-provider';
import { useUpdateMeMutation, useUploadMutation } from '../lib/query';
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
import { Input } from '@/components/ui/input';
import { AvatarUpload } from './avatar-upload';

type ProfileFormData = {
  name: string;
  username: string;
  image: string;
};

export function ProfileInfoCard({ user }: { user: AuthUser }) {
  const updateMe = useUpdateMeMutation();
  const upload = useUploadMutation();
  const form = useForm<ProfileFormData>({
    mode: 'onBlur',
    defaultValues: {
      name: user.name ?? '',
      username: user.username ?? '',
      image: user.image ?? '',
    },
  });

  const handleAvatarChange = (
    file: { file: File | { url: string }; id: string } | null
  ) => {
    if (!file) {
      form.setValue('image', '', { shouldDirty: true });
      return;
    }
    const f = file.file;
    if (f instanceof File) {
      upload.mutate(
        { file: f, prefix: 'avatars' },
        {
          onSuccess: (data) => {
            form.setValue('image', data.url, { shouldDirty: true });
          },
          onError: (err) => {
            form.setError('root', { message: getAuthErrorMessage(err) });
          },
        }
      );
    } else {
      form.setValue('image', f.url, { shouldDirty: true });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile information</CardTitle>
        <CardDescription>
          Your name and username are visible to others
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit((data) => {
            const payload: {
              name?: string;
              username?: string;
              image?: string;
            } = {
              name: data.name,
              username: data.username || undefined,
            };
            if (data.image?.match(/^https?:\/\/.+/)) payload.image = data.image;
            updateMe.mutate(payload, {
              onSuccess: () => toast.success('Profile updated'),
              onError: (err) =>
                form.setError('root', {
                  message: getAuthErrorMessage(err),
                }),
            });
          })}
          noValidate
        >
          <FieldGroup>
            {form.formState.errors.root?.message && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {form.formState.errors.root.message}
              </div>
            )}
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <AvatarUpload
                defaultAvatar={user.image ?? undefined}
                onFileChange={handleAvatarChange}
                maxSize={2 * 1024 * 1024}
              />
              <div className="flex-1 space-y-4">
                <Field data-invalid={!!form.formState.errors.name}>
                  <FieldLabel htmlFor="profile-name">Display name</FieldLabel>
                  <Input
                    id="profile-name"
                    type="text"
                    placeholder="Your name"
                    autoComplete="name"
                    aria-invalid={!!form.formState.errors.name}
                    aria-describedby={
                      form.formState.errors.name
                        ? 'profile-name-error'
                        : undefined
                    }
                    {...form.register('name', {
                      required: 'Name is required',
                      minLength: { value: 1, message: 'Name is required' },
                      maxLength: { value: 255, message: 'Name is too long' },
                    })}
                  />
                  <FieldError id="profile-name-error">
                    {form.formState.errors.name?.message}
                  </FieldError>
                </Field>
                <Field data-invalid={!!form.formState.errors.username}>
                  <FieldLabel htmlFor="profile-username">Username</FieldLabel>
                  <Input
                    id="profile-username"
                    type="text"
                    placeholder="username"
                    autoComplete="username"
                    aria-invalid={!!form.formState.errors.username}
                    aria-describedby={
                      form.formState.errors.username
                        ? 'profile-username-error'
                        : undefined
                    }
                    {...form.register('username')}
                  />
                  <FieldError id="profile-username-error">
                    {form.formState.errors.username?.message}
                  </FieldError>
                </Field>
              </div>
            </div>
            <Button
              type="submit"
              disabled={
                updateMe.isPending ||
                upload.isPending ||
                !form.formState.isDirty
              }
            >
              {updateMe.isPending || upload.isPending
                ? 'Saving…'
                : 'Save changes'}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
