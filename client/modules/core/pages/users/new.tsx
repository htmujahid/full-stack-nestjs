import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { paths } from '@/config/paths.config';
import { useCreateUserMutation, getUserErrorMessage, type CreateUserInput } from '../../lib/query';
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

export default function UserNewPage() {
  const navigate = useNavigate();
  const createUser = useCreateUserMutation();

  const form = useForm<UserFormData>({
    mode: 'onBlur',
    defaultValues: { name: '', email: '', username: '', phone: '', role: 'member' },
  });

  const onSubmit = (data: UserFormData) => {
    const input: CreateUserInput = {
      name: data.name,
      email: data.email,
      role: data.role,
      username: data.username || undefined,
      phone: data.phone || undefined,
    };
    createUser.mutate(input, {
      onSuccess: (user) => {
        toast.success('User created');
        navigate(paths.core.user(user.id));
      },
      onError: (err) => toast.error(getUserErrorMessage(err)),
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add user</h1>
        <p className="text-sm text-muted-foreground">Create a new user account</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User details</CardTitle>
          <CardDescription>
            Fill in the information below to create a new account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
              <UserFormFields form={form} />
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={createUser.isPending}>
                  {createUser.isPending ? 'Creating…' : 'Create user'}
                </Button>
                <Link
                  to={paths.core.users}
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
