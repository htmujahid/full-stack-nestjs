import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { paths } from '@/config/paths.config';
import { useUserQuery, useUpdateUserMutation, getUserErrorMessage } from '../../lib/query';
import { UserFormFields, type UserFormData } from '../../components/user-form-fields';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';

export default function UserEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: user, isLoading, isError } = useUserQuery(id!);
  const updateUser = useUpdateUserMutation(id!);

  const form = useForm<UserFormData>({
    mode: 'onBlur',
    defaultValues: { name: '', email: '', username: '', phone: '', role: 'member' },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name,
        email: user.email,
        username: user.username ?? '',
        phone: user.phone ?? '',
        role: user.role,
      });
    }
  }, [user, form]);

  if (!id) return null;

  const onSubmit = (data: UserFormData) => {
    updateUser.mutate(
      {
        name: data.name,
        email: data.email,
        username: data.username || undefined,
        phone: data.phone || undefined,
        role: data.role,
      },
      {
        onSuccess: () => {
          toast.success('User updated');
          navigate(paths.core.user(id));
        },
        onError: (err) => toast.error(getUserErrorMessage(err)),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">User not found</h1>
        <p className="text-muted-foreground">
          This user may have been deleted or the ID is invalid.
        </p>
        <Link
          to={paths.core.users}
          className={buttonVariants({ variant: 'outline' })}
        >
          Back to users
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit user</h1>
        <p className="text-sm text-muted-foreground">
          Update account information for {user.name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User details</CardTitle>
          <CardDescription>Make changes to the user's account below.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
              <UserFormFields form={form} />
              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={updateUser.isPending || !form.formState.isDirty}
                >
                  {updateUser.isPending ? 'Saving…' : 'Save changes'}
                </Button>
                <Link
                  to={paths.core.user(id)}
                  className={buttonVariants({ variant: 'outline' })}
                >
                  Cancel
                </Link>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
