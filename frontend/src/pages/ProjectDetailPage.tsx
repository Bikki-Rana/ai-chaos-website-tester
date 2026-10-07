import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Button from '../components/Button';
import { ExternalIcon } from '../components/Icons';
import Metric from '../components/Metric';
import { Banner, EmptyState, ErrorState, SkeletonRows } from '../components/States';
import StatusBadge from '../components/StatusBadge';
import { createRun, fetchProject, fetchProjectRuns, startRun } from '../lib/client';
import {
  formatDateTime,
  formatDuration,
  formatRelative,
  newestFirst,
  resultText,
  runDurationMs,
  shortId,
  statusLabel,
} from '../lib/format';
import { errMsg, useAsync, useNow, useRowClick } from '../lib/hooks';
import { paths } from '../lib/routes';

function toPositiveInt(v: string): number | null {
  const n = Number(v);
  return v.trim() !== '' && Number.isInteger(n) && n >= 1 ? n : null;
}

export default function ProjectDetailPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const onRowClick = useRowClick();

  const project = useAsync(() => fetchProject(projectId), [projectId]);
  const runsQ = useAsync(() => fetchProjectRuns(projectId), [projectId]);
  const reloadRuns = runsQ.reload;

  const runs = useMemo(() => newestFirst(runsQ.data ?? []), [runsQ.data]);
  const hasActive = runs.some((r) => r.status === 'RUNNING' || r.status === 'PENDING');
  const now = useNow(hasActive);

  useEffect(() => {
    if (!hasActive) return;
    const t = window.setInterval(() => reloadRuns(true), 4000);
    return () => window.clearInterval(t);
  }, [hasActive, reloadRuns]);

  const [maxPages, setMaxPages] = useState('10');
  const [maxDepth, setMaxDepth] = useState('2');
  const [attempted, setAttempted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [orphanRunId, setOrphanRunId] = useState<string | null>(null);

  const pagesInvalid = toPositiveInt(maxPages) === null;
  const depthInvalid = toPositiveInt(maxDepth) === null;

  async function start() {
    setAttempted(true);
    const mp = toPositiveInt(maxPages);
    const md = toPositiveInt(maxDepth);
    if (mp === null || md === null) return;
    setStarting(true);
    setStartError(null);
    setOrphanRunId(null);
    let createdId: string | null = null;
    try {
      const run = await createRun(projectId);
      createdId = run.id;
      await startRun(run.id, { max_pages: mp, max_depth: md });
      navigate(paths.run(run.id));
    } catch (err) {
      setStartError(errMsg(err));
      setOrphanRunId(createdId);
      setStarting(false);
      reloadRuns(true);
    }
  }

  if (project.error && !project.data) {
    return (
      <div className="ct-page">
        <nav className="ct-crumbs">
          <Link to={paths.projects}>Projects</Link>
        </nav>
        <ErrorState what="project" message={project.error} onRetry={() => project.reload()} />
      </div>
    );
  }

  const p = project.data;
  const latest = runs[0];
  const completed = runs.filter((r) => r.status === 'COMPLETED').length;
  const failed = runs.filter((r) => r.status === 'FAILED').length;
  const runsReady = runsQ.data !== undefined;

  return (
    <div className="ct-page">
      <nav className="ct-crumbs" aria-label="Breadcrumb">
        <Link to={paths.projects}>Projects</Link>
        <span aria-hidden="true">/</span>
        <span>{p?.name ?? '\u2026'}</span>
      </nav>

      <header className="ct-pagehead">
        <div className="ct-head-main">
          {p ? (
            <>
              <div className="ct-titlerow">
                <h1 className="ct-title">{p.name}</h1>
                {latest ? (
                  <StatusBadge status={latest.status} />
                ) : runsReady ? (
                  <span className="ct-faint ct-small">No runs yet</span>
                ) : null}
              </div>
              <a className="ct-ext ct-mono ct-wrap" href={p.url} target="_blank" rel="noreferrer noopener">
                {p.url}
                <ExternalIcon width={12} height={12} />
              </a>
            </>
          ) : (
            <>
              <span className="ct-skel" style={{ width: 220, height: 20, marginBottom: 10 }} />
              <span className="ct-skel" style={{ width: 280 }} />
            </>
          )}
        </div>
        <Button variant="primary" onClick={start} loading={starting} disabled={!p}>
          Run test
        </Button>
      </header>

      {startError ? (
        <Banner tone="bad">
          <strong>Could not start the run.</strong>
          <div className="ct-mono ct-wrap ct-muted">{startError}</div>
          {orphanRunId ? (
            <div className="ct-small" style={{ marginTop: 4 }}>
              A run record was created before the failure:{' '}
              <Link className="ct-link ct-mono" to={paths.run(orphanRunId)}>
                {shortId(orphanRunId)}
              </Link>
            </div>
          ) : null}
        </Banner>
      ) : null}

      <div className="ct-metrics" style={{ ['--cols' as string]: 4 }}>
        <Metric label="Total runs" value={runsReady ? runs.length : '\u2014'} />
        <Metric label="Successful runs" value={runsReady ? completed : '\u2014'} hint="Status completed" />
        <Metric label="Failed runs" value={runsReady ? failed : '\u2014'} bad={failed > 0} />
        <Metric
          label="Last run"
          value={latest ? formatRelative(latest.created_at, now) : '\u2014'}
          hint={latest ? statusLabel(latest.status) : undefined}
        />
      </div>

      {p && (p.description || p.testing_objective) ? (
        <section className="ct-panel" aria-label="Overview">
          <div className="ct-panel-head">
            <h2 className="ct-panel-title">Overview</h2>
          </div>
          <div className="ct-panel-body">
            {p.description ? (
              <>
                <div className="ct-section-label">Description</div>
                <div className="ct-wrap">{p.description}</div>
              </>
            ) : null}
            {p.testing_objective ? (
              <>
                <div className="ct-section-label">Testing objective</div>
                <div className="ct-wrap">{p.testing_objective}</div>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="ct-panel" aria-labelledby="cfg-title">
        <div className="ct-panel-head">
          <h2 className="ct-panel-title" id="cfg-title">
            Test configuration
          </h2>
        </div>
        <div className="ct-panel-body">
          <div className="ct-config">
            <div className="ct-field">
              <label className="ct-label" htmlFor="cfg-pages">
                Maximum pages
              </label>
              <input
                id="cfg-pages"
                className="ct-input"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={maxPages}
                onChange={(e) => setMaxPages(e.target.value)}
                aria-invalid={attempted && pagesInvalid ? true : undefined}
                disabled={starting}
              />
              {attempted && pagesInvalid ? (
                <div className="ct-field-error">Enter a whole number of at least 1.</div>
              ) : null}
            </div>
            <div className="ct-field">
              <label className="ct-label" htmlFor="cfg-depth">
                Maximum crawl depth
              </label>
              <input
                id="cfg-depth"
                className="ct-input"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={maxDepth}
                onChange={(e) => setMaxDepth(e.target.value)}
                aria-invalid={attempted && depthInvalid ? true : undefined}
                disabled={starting}
              />
              {attempted && depthInvalid ? (
                <div className="ct-field-error">Enter a whole number of at least 1.</div>
              ) : null}
            </div>
            <div className="ct-field">
              <span className="ct-label" aria-hidden="true">
                &nbsp;
              </span>
              <Button variant="primary" onClick={start} loading={starting} disabled={!p}>
                Run chaos test
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="ct-panel" aria-labelledby="hist-title">
        <div className="ct-panel-head">
          <h2 className="ct-panel-title" id="hist-title">
            Run history
            {runsReady ? <span className="ct-panel-count">{runs.length}</span> : null}
          </h2>
        </div>
        {runsQ.error && !runsQ.data ? (
          <div className="ct-panel-body">
            <ErrorState what="run history" message={runsQ.error} onRetry={() => runsQ.reload()} />
          </div>
        ) : !runsReady ? (
          <SkeletonRows />
        ) : runs.length === 0 ? (
          <EmptyState
            title="No runs yet"
            description="Configure the limits above and run a chaos test to explore this site."
          />
        ) : (
          <div className="ct-tablewrap">
            <table className="ct-table">
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Duration</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const to = paths.run(r.id);
                  return (
                    <tr key={r.id} className="ct-clickable" onClick={(e) => onRowClick(e, to)}>
                      <td className="ct-cell-main">
                        <Link className="ct-link ct-mono" to={to} title={r.id}>
                          {shortId(r.id)}
                        </Link>
                      </td>
                      <td data-label="Status">
                        <StatusBadge status={r.status} />
                      </td>
                      <td data-label="Created" title={formatDateTime(r.created_at)}>
                        {formatRelative(r.created_at, now)}
                      </td>
                      <td data-label="Duration" className="ct-mono">
                        {formatDuration(runDurationMs(r, now))}
                      </td>
                      <td data-label="Result" className={r.status === 'FAILED' ? 'ct-bad-text' : 'ct-muted'}>
                        <span className="ct-clamp">{resultText(r)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}