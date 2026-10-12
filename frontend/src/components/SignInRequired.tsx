import { Link, useLocation } from 'react-router-dom';
import { paths } from '../lib/routes';

export default function SignInRequired({ from }: { from?: string }) {
  const location = useLocation();
  const state = location.state as { from?: string; reason?: string } | null;
  const target = from ?? state?.from ?? paths.projects;
  const forRun = state?.reason === 'run';

  return (
    <div className="ct-page">
      <div className="ct-gate">
        <h1>{forRun ? 'Log in to run this test' : 'Sign in to continue'}</h1>
        <p>
          {forRun
            ? 'Log in first. Your project is kept on this device, and the test starts as soon as you sign in.'
            : 'This page belongs to your account. Sign in or create an account to continue.'}
        </p>
        <div className="ct-actions-row" style={{ marginTop: 0, marginBottom: 14 }}>
          <Link className="ct-btn ct-btn-primary" to={paths.login} state={{ from: target }}>
            Sign in
          </Link>
          <Link className="ct-btn" to={paths.signup} state={{ from: target }}>
            Create account
          </Link>
        </div>
        <Link className="ct-inline-link" to={paths.projects}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}