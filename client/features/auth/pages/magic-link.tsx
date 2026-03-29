import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { MagicLinkForm } from '../components/magic-link-form';

export default function MagicLinkPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Sign in with magic link</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a sign-in link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MagicLinkForm />
        </CardContent>
      </Card>
    </div>
  );
}
