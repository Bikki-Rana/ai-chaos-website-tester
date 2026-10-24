import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/Button';
import { useAuth } from '../lib/auth';
import { listDrafts, removeDraft, useDrafts } from '../lib/drafts';
import { errMsg, useAsync } from '../lib/hooks';
import { paths } from '../lib/routes';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../lib/settings';
import { changePassword } from '../services/api';

interface Health {
  status?: string;
  version?: string;
  database?: string;
}

const API_ROOT = String(import.meta.env.VITE_API_BASE_URL ?? '');
const IS_LOCAL_API = /localhost|127\.0\.0\.1/.test(API_ROOT);

async function loadHealth(): Promise<Health> {
  const res = await fetch(`${API_ROOT}/health`);
  if (!res.ok) throw new Error(`The backend answered ${res.status}.`);
  return (await res.json()) as Health;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="ct-panel">
      <div className="ct-panel-head">
        <h2 className="ct-panel-title">{title}</h2>
      </div>
      <div className="ct-panel-body">{children}</div>
    </section>
  );
}

function AccountPanel() {
  const { user, status, signOut } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (status !== 'authed' || !user) {
    return (
      <Panel title="Account">
        <p className="ct-muted" style={{ margin: '0 0 12px' }}>
          You are browsing as a guest. Sign in to keep your projects in an account.
        </p>
        <div className="ct-actions-row" style={{ marginTop: 0 }}>
          <Link className="ct-btn ct-btn-primary" to={paths.login} state={{ from: paths.settings }}>
            Sign in
          </Link>
          <Link className="ct-btn" to={paths.signup} state={{ from: paths.settings }}>
            Create account
          </Link>
        </div>
      </Panel>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setDone(false);
    if (next.length < 8) return setError('Use at least 8 characters for the new password.');
    if (next !== confirm) return setError('The new passwords do not match.');
    setBusy(true);
    setError(null);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Account">
      <dl className="ct-kvlist">
        <dt>Email</dt>
        <dd>{user.email}</dd>
      </dl>
      <form onSubmit={submit} noValidate style={{ marginTop: 16, maxWidth: 360 }}>
        <div className="ct-section-label">Change password</div>
        <div className="ct-field">
          <label className="ct-label" htmlFor="st-current">Current password</label>
          <input id="st-current" className="ct-input" type="password" autoComplete="current-password"
            value={current} onChange={(e) => setCurrent(e.target.value)} disabled={busy} />
        </div>
        <div className="ct-field">
          <label className="ct-label" htmlFor="st-new">New password</label>
          <input id="st-new" className="ct-input" type="password" autoComplete="new-password"
            value={next} onChange={(e) => setNext(e.target.value)} disabled={busy} />
        </div>
        <div className="ct-field">
          <label className="ct-label" htmlFor="st-confirm">Confirm new password</label>
          <input id="st-confirm" className="ct-input" type="password" autoComplete="new-password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={busy} />
        </div>
        {error ? <div className="ct-field-error" role="alert" style={{ marginBottom: 10 }}>{error}</div> : null}
        {done ? <div className="ct-small" style={{ color: '#8ad4b0', marginBottom: 10 }}>Password updated.</div> : null}
        <div className="ct-actions-row" style={{ marginTop: 4 }}>
          <Button type="submit" variant="primary" loading={busy} disabled={!current || !next}>
            Update password
          </Button>
          <Button onClick={signOut}>Sign out</Button>
        </div>
      </form>
    </Panel>
  );
}

function DefaultsPanel() {
  const initial = loadSettings();
  const [pages, setPages] = useState(String(initial.maxPages));
  const [depth, setDepth] = useState(String(initial.maxDepth));

  const valid = (v: string, max: number) => {
    const n = Number(v);
    return v.trim() !== '' && Number.isInteger(n) && n >= 1 && n <= max;
  };

  function update(field: 'maxPages' | 'maxDepth', value: string, max: number, set: (v: string) => void) {
    set(value);
    if (valid(value, max)) saveSettings({ ...loadSettings(), [field]: Number(value) });
  }

  function reset() {
    saveSettings({ ...loadSettings(), maxPages: DEFAULT_SETTINGS.maxPages, maxDepth: DEFAULT_SETTINGS.maxDepth });
    setPages(String(DEFAULT_SETTINGS.maxPages));
    setDepth(String(DEFAULT_SETTINGS.maxDepth));
  }

  return (
    <Panel title="Test defaults">
      <p className="ct-muted ct-small" style={{ margin: '0 0 12px' }}>
        Starting values for the limits on every project page. You can still change them per run.
      </p>
      <div className="ct-config" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 170px)) auto' }}>
        <div className="ct-field">
          <label className="ct-label" htmlFor="st-pages">Maximum pages (1 to 50)</label>
          <input id="st-pages" className="ct-input" type="number" min={1} max={50} value={pages}
            onChange={(e) => update('maxPages', e.target.value, 50, setPages)}
            aria-invalid={!valid(pages, 50) ? true : undefined} />
        </div>
        <div className="ct-field">
          <label className="ct-label" htmlFor="st-depth">Maximum crawl depth (1 to 10)</label>
          <input id="st-depth" className="ct-input" type="number" min={1} max={10} value={depth}
            onChange={(e) => update('maxDepth', e.target.value, 10, setDepth)}
            aria-invalid={!valid(depth, 10) ? true : undefined} />
        </div>
        <div className="ct-field">
          <span className="ct-label" aria-hidden="true">&nbsp;</span>
          <Button onClick={reset}>Reset</Button>
        </div>
      </div>
    </Panel>
  );
}

function AppearancePanel() {
  const [reduce, setReduce] = useState(() => loadSettings().reduceEffects);
  return (
    <Panel title="Appearance">
      <label className="ct-check" htmlFor="st-reduce">
        <input
          id="st-reduce"
          type="checkbox"
          checked={reduce}
          onChange={(e) => {
            setReduce(e.target.checked);
            saveSettings({ ...loadSettings(), reduceEffects: e.target.checked });
          }}
        />
        <span>
          Reduce 3D effects
          <span className="ct-muted ct-small" style={{ display: 'block' }}>
            Stops the animated cubes on the dashboard and sign-in page. Takes effect when you open those pages.
            Your system's reduced-motion setting is respected automatically.
          </span>
        </span>
      </label>
    </Panel>
  );
}

function GuestPanel() {
  const drafts = useDrafts();
  const [confirming, setConfirming] = useState(false);
  if (drafts.length === 0) return null;
  return (
    <Panel title="Guest projects">
      <p className="ct-muted" style={{ margin: '0 0 12px' }}>
        {drafts.length} {drafts.length === 1 ? 'project is' : 'projects are'} stored in this browser only.
      </p>
      {confirming ? (
        <div className="ct-actions-row" style={{ marginTop: 0 }}>
          <Button
            className="ct-btn-danger"
            onClick={() => {
              listDrafts().forEach((d) => removeDraft(d.id));
              setConfirming(false);
            }}
          >
            Yes, remove them
          </Button>
          <Button onClick={() => setConfirming(false)}>Cancel</Button>
        </div>
      ) : (
        <Button onClick={() => setConfirming(true)}>Clear guest projects</Button>
      )}
    </Panel>
  );
}

function SystemPanel() {
  const { data, error, loading } = useAsync(loadHealth, []);
  let host = API_ROOT;
  try {
    host = new URL(API_ROOT).host;
  } catch {
    /* keep the raw value */
  }
  const sqliteOnline = data?.database === 'sqlite' && !IS_LOCAL_API;

  return (
    <Panel title="System">
      <dl className="ct-kvlist">
        <dt>Backend</dt>
        <dd>{host || 'not set'}</dd>
        <dt>Status</dt>
        <dd>{loading ? 'Checking...' : error ? `Unreachable (${error})` : 'Reachable'}</dd>
        {data?.version ? (<><dt>Version</dt><dd>{data.version}</dd></>) : null}
        {data?.database ? (<><dt>Database</dt><dd>{data.database}</dd></>) : null}
      </dl>
      {sqliteOnline ? (
        <div className="ct-banner ct-banner-warn" style={{ marginTop: 14, marginBottom: 0 }} role="status">
          <div className="ct-banner-body">
            <strong>Your data will not survive a redeploy.</strong> The live backend stores everything in a
            SQLite file on its own disk, which is erased on every deploy or restart. Set a PostgreSQL
            <span className="ct-mono"> DATABASE_URL</span> and a <span className="ct-mono">SECRET_KEY</span> on
            the backend service.
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

export default function SettingsPage() {
  return (
    <div className="ct-page">
      <header className="ct-pagehead">
        <div>
          <h1 className="ct-title">Settings</h1>
          <p className="ct-sub">Your account, test defaults and how the app behaves on this device.</p>
        </div>
      </header>
      <AccountPanel />
      <DefaultsPanel />
      <AppearancePanel />
      <GuestPanel />
      <SystemPanel />
    </div>
  );
}