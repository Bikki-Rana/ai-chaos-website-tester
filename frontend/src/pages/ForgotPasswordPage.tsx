import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import Button from '../components/Button';
import { errMsg } from '../lib/hooks';
import { paths } from '../lib/routes';
import { forgotPassword } from '../services/api';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSubmitting(false);
    }
  }

  const back = <Link to={paths.login}>Back to sign in</Link>;

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        subtitle={`If an account exists for ${email.trim()}, we sent a link to reset the password. It expires in 30 minutes.`}
        footer={back}
      >
        <p className="ct-small ct-muted" style={{ margin: '0 0 12px' }}>
          Nothing arrived? Check spam, then wait a minute and try again.
        </p>
        <Button className="ct-btn-block" onClick={() => setSent(false)}>
          Use a different email
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email you signed up with and we will send you a reset link."
      footer={back}
    >
      <form onSubmit={submit} noValidate>
        <div className="ct-field">
          <label className="ct-label" htmlFor="fp-email">
            Email
          </label>
          <input
            id="fp-email"
            className="ct-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
            disabled={submitting}
            autoFocus
          />
          {error ? <div className="ct-field-error" role="alert">{error}</div> : null}
        </div>
        <Button type="submit" variant="primary" className="ct-btn-block" loading={submitting}>
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
}