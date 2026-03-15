import { toast } from 'sonner';
import { useDeleteUserMutation, getUserErrorMessage, type User } from '../lib/query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Props = {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after successful deletion. Defaults to closing the dialog. */
  onDeleted?: () => void;
};

export function UserDeleteDialog({ user, open, onOpenChange, onDeleted }: Props) {
  const deleteUser = useDeleteUserMutation();

  const handleDelete = () => {
    deleteUser.mutate(user.id, {
      onSuccess: () => {
        toast.success(`${user.name} deleted`);
        onOpenChange(false);
        onDeleted?.();
      },
      onError: (err) => toast.error(getUserErrorMessage(err)),
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {user.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The user account will be permanently
            removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteUser.isPending}
          >
            {deleteUser.isPending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
