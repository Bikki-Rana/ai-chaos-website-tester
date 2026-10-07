import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import Button from '../components/Button';
import { LogoIcon } from '../components/Icons';
import { useAuth } from '../lib/auth';
import { errMsg } from '../lib/hooks';
import { paths } from '../lib/routes';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { status, signIn, signUp } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? paths.projects;
  const isSignup = mode === 'signup';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (status === 'authed') return <Navigate to={from} replace />;
  if (status === 'loading') {
    return (
      <div className="ct-auth">
        <span className="ct-spinner" aria-label="Loading" />
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: FieldErrors = {};
    if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Password is required.';
    else if (isSignup && password.length < 8) next.password = 'Use at least 8 characters.';
    setErrors(next);
    if (next.email || next.password) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      if (isSignup) await signUp(email.trim(), password);
      else await signIn(email.trim(), password);
      // On success the provider flips to "authed" and this page redirects.
    } catch (err) {
      setSubmitError(errMsg(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="ct-auth">
      <div className="ct-auth-card">
        <div className="ct-auth-brand">
          <LogoIcon />
          <span>AI Chaos Tester</span>
        </div>
        <h1>{isSignup ? 'Create account' : 'Sign in'}</h1>
        <p className="ct-sub">
          {isSignup
            ? 'Your projects and runs are private to your account.'
            : 'Sign in to access your projects and runs.'}
        </p>

        <form onSubmit={submit} noValidate>
          <div className="ct-field">
            <label className="ct-label" htmlFor="auth-email">
              Email
            </label>
            <input
              id="auth-email"
              className="ct-input"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={errors.email ? true : undefined}
              disabled={submitting}
              autoFocus
            />
            {errors.email ? <div className="ct-field-error">{errors.email}</div> : null}
          </div>
          <div className="ct-field">
            <label className="ct-label" htmlFor="auth-password">
              Password
            </label>
            <input
              id="auth-password"
              className="ct-input"
              type="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={errors.password ? true : undefined}
              disabled={submitting}
            />
            {errors.password ? <div className="ct-field-error">{errors.password}</div> : null}
          </div>

          {submitError ? (
            <div className="ct-field-error" role="alert" style={{ marginBottom: 12 }}>
              {submitError}
            </div>
          ) : null}

          <Button type="submit" variant="primary" className="ct-btn-block" loading={submitting}>
            {isSignup ? 'Create account' : 'Sign in'}
          </Button>
        </form>

        <div className="ct-auth-foot">
          {isSignup ? (
            <>
              Already have an account?{' '}
              <Link to={paths.login} state={location.state}>
                Sign in
              </Link>
            </>
          ) : (
            <>
              New here?{' '}
              <Link to={paths.signup} state={location.state}>
                Create an account
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}