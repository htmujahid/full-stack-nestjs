import { Link } from 'react-router';

export default function SignInPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="mt-2 text-muted-foreground">Sign in page placeholder.</p>
      <Link to="/home" className="mt-4 inline-block text-primary hover:underline">
        ← Home
      </Link>
    </div>
  );
}
