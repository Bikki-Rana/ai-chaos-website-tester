import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import Button from '../components/Button';
import { errMsg } from '../lib/hooks';
import { paths } from '../lib/routes';
import { resetPassword } from '../services/api';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <AuthShell
        title="Invalid reset link"
        subtitle="This link is missing its token. Request a new one."
        footer={<Link to={paths.login}>Back to sign in</Link>}
      >
        <Link className="ct-btn ct-btn-primary ct-btn-block" to={paths.forgot}>
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="You can now sign in with your new password.">
        <Link className="ct-btn ct-btn-primary ct-btn-block" to={paths.login}>
          Sign in
        </Link>
      </AuthShell>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: { password?: string; confirm?: string } = {};
    if (password.length < 8) next.password = 'Use at least 8 characters.';
    if (confirm !== password) next.confirm = 'Passwords do not match.';
    setErrors(next);
    if (next.password || next.confirm) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setSubmitError(errMsg(err));
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Use at least 8 characters."
      footer={<Link to={paths.login}>Back to sign in</Link>}
    >
      <form onSubmit={submit} noValidate>
        <div className="ct-field">
          <label className="ct-label" htmlFor="rp-password">
            New password
          </label>
          <input
            id="rp-password"
            className="ct-input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={errors.password ? true : undefined}
            disabled={submitting}
            autoFocus
          />
          {errors.password ? <div className="ct-field-error">{errors.password}</div> : null}
        </div>
        <div className="ct-field">
          <label className="ct-label" htmlFor="rp-confirm">
            Confirm password
          </label>
          <input
            id="rp-confirm"
            className="ct-input"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={errors.confirm ? true : undefined}
            disabled={submitting}
          />
          {errors.confirm ? <div className="ct-field-error">{errors.confirm}</div> : null}
        </div>
        {submitError ? (
          <div className="ct-field-error" role="alert" style={{ marginBottom: 12 }}>
            {submitError}{' '}
            <Link className="ct-inline-link" to={paths.forgot}>
              Request a new link
            </Link>
          </div>
        ) : null}
        <Button type="submit" variant="primary" className="ct-btn-block" loading={submitting}>
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}