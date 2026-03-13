import { Link } from 'react-router';

export default function HomePage() {
  return (
    <div>
      <h1 className="text-3xl font-bold">crude</h1>
      <p className="mt-2 text-muted-foreground">Welcome home.</p>
      <nav className="mt-4 flex gap-4">
        <Link to="/auth/sign-in" className="text-primary hover:underline">
          Sign in
        </Link>
        <Link to="/auth/sign-up" className="text-primary hover:underline">
          Sign up
        </Link>
      </nav>
    </div>
  );
}
