import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Button from '../components/Button';
import { Banner, EmptyState, SkeletonRows } from '../components/States';
import { useAuth } from '../lib/auth';
import { createRun, startRun } from '../lib/client';
import { claimDrafts, clearPendingRun, getPendingRun, setPendingRun, useDrafts } from '../lib/drafts';
import { errMsg } from '../lib/hooks';
import { paths } from '../lib/routes';
import { loadSettings } from '../lib/settings';
import DeleteProjectDialog from '../components/DeleteProjectDialog';

const toInt = (v: string): number | null => {
  const n = Number(v);
  return v.trim() !== '' && Number.isInteger(n) && n >= 1 ? n : null;
};

function NumberField({ id, label, value, onChange, invalid }: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
}) {
  return (
    <div className="ct-field">
      <label className="ct-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="ct-input"
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid ? true : undefined}
      />
      {invalid ? <div className="ct-field-error">Enter a whole number of at least 1.</div> : null}
    </div>
  );
}

/** A project a guest created. Opening it needs no login; running it does. */
export default function DraftProjectPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const { status } = useAuth();
  const navigate = useNavigate();
  const draft = useDrafts().find((d) => d.id === projectId);

  const [maxPages, setMaxPages] = useState(() => String(loadSettings().maxPages));
  const [maxDepth, setMaxDepth] = useState(() => String(loadSettings().maxDepth));
  const [attempted, setAttempted] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Once signed in: save the project to the account and start the test the guest asked for.
  useEffect(() => {
    if (status !== 'authed') return;
    let alive = true;
    (async () => {
      try {
        const mapping = await claimDrafts();
        if (!alive) return;
        const newId = mapping.get(projectId);
        const pending = getPendingRun();
        if (pending && pending.draftId === projectId && newId) {
          clearPendingRun();
          const run = await createRun(newId);
          await startRun(run.id, { max_pages: pending.max_pages, max_depth: pending.max_depth });
          if (alive) navigate(paths.run(run.id), { replace: true });
          return;
        }
        navigate(newId ? paths.project(newId) : paths.projects, { replace: true });
      } catch (err) {
        if (alive) setResumeError(errMsg(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, [status, projectId, attempt, navigate]);

  if (status === 'loading') {
    return <div className="ct-page"><SkeletonRows rows={4} /></div>;
  }

  if (status === 'authed') {
    return (
      <div className="ct-page">
        {resumeError ? (
          <Banner tone="bad">
            <strong>Could not finish setting up your project.</strong>
            <div className="ct-mono ct-wrap ct-muted">{resumeError}</div>
            <div className="ct-actions-row" style={{ marginTop: 10 }}>
              <Button size="sm" onClick={() => { setResumeError(null); setAttempt((a) => a + 1); }}>
                Try again
              </Button>
              <Link className="ct-btn ct-btn-sm" to={paths.projects}>Go to dashboard</Link>
            </div>
          </Banner>
        ) : (
          <Banner tone="info" icon={<span className="ct-spinner" aria-hidden="true" />}>
            Saving your project and starting the test.
          </Banner>
        )}
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="ct-page">
        <EmptyState
          title="Project not found on this device"
          description="Guest projects are stored in the browser where they were created."
          action={<Link className="ct-btn" to={paths.projects}>Go to dashboard</Link>}
        />
      </div>
    );
  }

  const mp = toInt(maxPages);
  const md = toInt(maxDepth);

  function run() {
    setAttempted(true);
    if (mp === null || md === null) return;
    setPendingRun({ draftId: projectId, max_pages: mp, max_depth: md });
    navigate(paths.signInRequired, { state: { from: paths.project(projectId), reason: 'run' } });
  }

  return (
    <div className="ct-page">
      <nav className="ct-crumbs" aria-label="Breadcrumb">
        <Link to={paths.projects}>Projects</Link>
        <span aria-hidden="true">/</span>
        <span>{draft.name}</span>
      </nav>

      <header className="ct-pagehead">
        <div className="ct-head-main">
          <div className="ct-titlerow">
            <h1 className="ct-title">{draft.name}</h1>
            <span className="ct-sev">Draft</span>
          </div>
          <a className="ct-ext ct-mono ct-wrap" href={draft.url} target="_blank" rel="noreferrer noopener">
            {draft.url}
          </a>
        </div>
        <div className="ct-head-actions">
          <Button variant="ghost" className="ct-btn-quiet-danger" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
          <Button variant="primary" onClick={run}>Run test</Button>
        </div>
        {confirmDelete && draft ? (
          <DeleteProjectDialog
            target={{ id: draft.id, name: draft.name, draft: true }}
            onClose={() => setConfirmDelete(false)}
            onDeleted={() => navigate(paths.projects)}
          />
        ) : null}
      </header>

      {draft.description || draft.testing_objective ? (
        <section className="ct-panel" aria-label="Overview">
          <div className="ct-panel-body">
            {draft.description ? <div className="ct-wrap">{draft.description}</div> : null}
            {draft.testing_objective ? (
              <>
                <div className="ct-section-label">Testing objective</div>
                <div className="ct-wrap">{draft.testing_objective}</div>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="ct-panel" aria-labelledby="cfg-title">
        <div className="ct-panel-head">
          <h2 className="ct-panel-title" id="cfg-title">Test configuration</h2>
        </div>
        <div className="ct-panel-body">
          <div className="ct-config">
            <NumberField id="cfg-pages" label="Maximum pages" value={maxPages} onChange={setMaxPages} invalid={attempted && mp === null} />
            <NumberField id="cfg-depth" label="Maximum crawl depth" value={maxDepth} onChange={setMaxDepth} invalid={attempted && md === null} />
            <div className="ct-field">
              <span className="ct-label" aria-hidden="true">&nbsp;</span>
              <Button variant="primary" onClick={run}>Run chaos test</Button>
            </div>
          </div>
          <p className="ct-small ct-faint" style={{ margin: '12px 0 0' }}>
            You will be asked to log in when you run the test. Your project is saved on this device until then.
          </p>
        </div>
      </section>
    </div>
  );
}