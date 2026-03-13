import { Link } from 'react-router';

export default function SignUpPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Sign up</h1>
      <p className="mt-2 text-muted-foreground">Sign up page placeholder.</p>
      <Link to="/home" className="mt-4 inline-block text-primary hover:underline">
        ← Home
      </Link>
    </div>
  );
}
