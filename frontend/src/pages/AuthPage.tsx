import { useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import Button from '../components/Button';
import type { ChaosCubeHandle } from '../components/ChaosCube';
import { useAuth } from '../lib/auth';
import { errMsg } from '../lib/hooks';
import { paths } from '../lib/routes';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const STRENGTH = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];

function scorePassword(p: string): number {
  if (p.length < 8) return 0;
  let s = 1;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(4, s);
}

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { status, signIn, signUp } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? paths.projects;
  const isSignup = mode === 'signup';

  const cubeRef = useRef<ChaosCubeHandle>(null);
  const lastPoke = useRef(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  if (status === 'authed') return <Navigate to={from} replace />;
  if (status === 'loading') {
    return (
      <div className="ct-auth">
        <span className="ct-spinner" aria-label="Loading" />
      </div>
    );
  }

  const poke = () => {
    const now = performance.now();
    if (now - lastPoke.current > 140) {
      lastPoke.current = now;
      cubeRef.current?.pulse(0.22);
    }
  };

  const fail = () => {
    cubeRef.current?.glitch();
    setShake(true);
    window.setTimeout(() => setShake(false), 450);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState('CapsLock'));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: FieldErrors = {};
    if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Password is required.';
    else if (isSignup && password.length < 8) next.password = 'Use at least 8 characters.';
    setErrors(next);
    if (next.email || next.password) {
      fail();
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      if (isSignup) await signUp(email.trim(), password);
      else await signIn(email.trim(), password);
      // On success the provider flips to "authed" and this page redirects.
    } catch (err) {
      setSubmitError(errMsg(err));
      setSubmitting(false);
      fail();
    }
  }

  const strength = scorePassword(password);

  return (
    <AuthShell
      cubeRef={cubeRef}
      shake={shake}
      title={isSignup ? 'Create your account' : 'Welcome back'}
      subtitle={
        isSignup
          ? 'Your projects and runs stay private to your account.'
          : 'Sign in to see your projects and runs.'
      }
      footer={
        isSignup ? (
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
        )
      }
    >
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
            onChange={(e) => {
              setEmail(e.target.value);
              poke();
            }}
            aria-invalid={errors.email ? true : undefined}
            disabled={submitting}
            autoFocus
          />
          {errors.email ? <div className="ct-field-error">{errors.email}</div> : null}
        </div>
        <div className="ct-field">
          <div className="ct-label-row">
            <label className="ct-label" htmlFor="auth-password">
              Password
            </label>
            {!isSignup ? (
              <Link className="ct-inline-link" to={paths.forgot}>
                Forgot password?
              </Link>
            ) : null}
          </div>
          <div className="ct-pwrap">
            <input
              id="auth-password"
              className="ct-input"
              type={show ? 'text' : 'password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                poke();
              }}
              onKeyUp={onKey}
              onKeyDown={onKey}
              aria-invalid={errors.password ? true : undefined}
              disabled={submitting}
            />
            <button
              type="button"
              className="ct-pwtoggle"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? 'Hide password' : 'Show password'}
              aria-pressed={show}
            >
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
          {caps ? <div className="ct-hint-warn">Caps Lock is on</div> : null}
          {errors.password ? <div className="ct-field-error">{errors.password}</div> : null}
          {isSignup && password ? (
            <>
              <div className="ct-meter" aria-hidden="true">
                {[1, 2, 3, 4].map((n) => (
                  <span key={n} className={strength >= n ? `on-${strength}` : ''} />
                ))}
              </div>
              <div className="ct-meter-label">{STRENGTH[strength]}</div>
            </>
          ) : null}
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
    </AuthShell>
  );
}