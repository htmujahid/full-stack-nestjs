import type { UseFormReturn } from 'react-hook-form';
import type { UserRole } from '../lib/query';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type UserFormData = {
  name: string;
  email: string;
  username: string;
  phone: string;
  role: UserRole;
};

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
  { value: 'superadmin', label: 'Super Admin' },
];

export function UserFormFields({
  form,
}: {
  form: UseFormReturn<UserFormData>;
}) {
  return (
    <>
      <Field>
        <FieldLabel>Name</FieldLabel>
        <Input
          {...form.register('name', { required: 'Name is required' })}
          placeholder="Jane Doe"
        />
        <FieldError errors={[form.formState.errors.name]} />
      </Field>

      <Field>
        <FieldLabel>Email</FieldLabel>
        <Input
          type="email"
          {...form.register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: 'Enter a valid email address',
            },
          })}
          placeholder="jane@example.com"
        />
        <FieldError errors={[form.formState.errors.email]} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel>Username (optional)</FieldLabel>
          <Input {...form.register('username')} placeholder="janedoe" />
        </Field>

        <Field>
          <FieldLabel>Phone (optional)</FieldLabel>
          <Input {...form.register('phone')} placeholder="+1234567890" />
        </Field>
      </div>

      <Field>
        <FieldLabel>Role</FieldLabel>
        <Select
          value={form.watch('role')}
          onValueChange={(v) =>
            form.setValue('role', (v as UserRole) ?? 'member', {
              shouldDirty: true,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </>
  );
}
