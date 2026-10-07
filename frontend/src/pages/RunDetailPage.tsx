import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import Button, { CopyButton } from '../components/Button';
import FailureRow from '../components/FailureRow';
import { ChevronDownIcon, ChevronRightIcon, RefreshIcon } from '../components/Icons';
import Metric from '../components/Metric';
import { Banner, EmptyState, ErrorState, ShowMore, SkeletonRows } from '../components/States';
import StatusBadge from '../components/StatusBadge';
import {
  fetchActions,
  fetchFailures,
  fetchPages,
  fetchProject,
  fetchRun,
  fetchStates,
} from '../lib/client';
import {
  formatDateTime,
  formatDuration,
  formatTime,
  parseTs,
  runDurationMs,
  shortId,
} from '../lib/format';
import { useAsync, useNow } from '../lib/hooks';
import type { AsyncState } from '../lib/hooks';
import { paths } from '../lib/routes';
import type { StateRecord, TestRun } from '../types';

type Tab = 'failures' | 'actions' | 'pages' | 'states';

const ROW_LIMIT = 200;
const SEV_RANK: Record<string, number> = {
  critical: 0,
  fatal: 0,
  high: 1,
  error: 1,
  medium: 2,
  warning: 2,
  warn: 2,
  low: 3,
};
const sevRank = (s: string) => SEV_RANK[s.toLowerCase()] ?? 4;

function failuresEmpty(status: TestRun['status']): string {
  switch (status) {
    case 'COMPLETED':
      return 'The run finished without recording any failures.';
    case 'FAILED':
      return 'The run failed before recording any failures. See the run error above.';
    case 'STOPPED':
      return 'No failures were recorded before the run was stopped.';
    default:
      return 'No failures recorded so far. This list refreshes while the run is in progress.';
  }
}

function Section<T>({
  q,
  items,
  what,
  empty,
  children,
}: {
  q: AsyncState<unknown>;
  items: T[];
  what: string;
  empty: ReactNode;
  children: (items: T[]) => ReactNode;
}) {
  if (q.error && !q.data) {
    return (
      <div className="ct-panel-body">
        <ErrorState what={what} message={q.error} onRetry={() => q.reload()} />
      </div>
    );
  }
  if (!q.data) return <SkeletonRows />;
  if (items.length === 0) return <>{empty}</>;
  return <>{children(items)}</>;
}

function StateRow({ state, index }: { state: StateRecord; index: number }) {
  const [open, setOpen] = useState(false);
  const selectors = state.state_data?.selectors ?? [];
  return (
    <>
      <tr>
        <td className="ct-cell-main">
          <button
            type="button"
            className="ct-linkbtn"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <ChevronDownIcon /> : <ChevronRightIcon />}
            State {index}
          </button>
        </td>
        <td data-label="DOM hash">
          <span className="ct-mono" title={state.dom_hash}>
            {state.dom_hash.slice(0, 12)}
          </span>
        </td>
        <td data-label="Elements" className="ct-num">
          {state.state_data?.element_count ?? '\u2014'}
        </td>
        <td data-label="Selectors" className="ct-num">
          {selectors.length}
        </td>
        <td data-label="Title hint">{state.state_data?.title_hint || '\u2014'}</td>
      </tr>
      {open ? (
        <tr className="ct-subrow">
          <td colSpan={5}>
            <div className="ct-expand">
              <div className="ct-kv">
                <span className="ct-faint">Full hash</span>
                <span className="ct-mono ct-wrap">{state.dom_hash}</span>
                <CopyButton text={state.dom_hash} />
              </div>
              <div className="ct-section-label">Selectors ({selectors.length})</div>
              {selectors.length > 0 ? (
                <pre className="ct-pre">
                  {selectors.slice(0, 100).join('\n')}
                  {selectors.length > 100 ? `\n\u2026 ${selectors.length - 100} more` : ''}
                </pre>
              ) : (
                <div className="ct-faint ct-small">None recorded.</div>
              )}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export default function RunDetailPage() {
  const { runId = '' } = useParams<{ runId: string }>();

  const run = useAsync(() => fetchRun(runId), [runId]);
  const pages = useAsync(() => fetchPages(runId), [runId]);
  const states = useAsync(() => fetchStates(runId), [runId]);
  const actions = useAsync(() => fetchActions(runId), [runId]);
  const failures = useAsync(() => fetchFailures(runId), [runId]);

  const projectId = run.data?.project_id;
  const project = useAsync(async () => (projectId ? fetchProject(projectId) : undefined), [projectId]);

  const status = run.data?.status;
  const active = status === 'RUNNING' || status === 'PENDING';
  const now = useNow(status === 'RUNNING');

  const reloadRun = run.reload;
  const reloadPages = pages.reload;
  const reloadStates = states.reload;
  const reloadActions = actions.reload;
  const reloadFailures = failures.reload;
  const reloadAll = useCallback(
    (silent = false) => {
      reloadRun(silent);
      reloadPages(silent);
      reloadStates(silent);
      reloadActions(silent);
      reloadFailures(silent);
    },
    [reloadRun, reloadPages, reloadStates, reloadActions, reloadFailures],
  );

  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => reloadAll(true), 3000);
    return () => window.clearInterval(t);
  }, [active, reloadAll]);

  // One final refresh when a run leaves RUNNING/PENDING.
  const wasActive = useRef(false);
  useEffect(() => {
    if (wasActive.current && !active) reloadAll(true);
    wasActive.current = active;
  }, [active, reloadAll]);

  const [tabState, setTab] = useState<Tab | null>(null);
  const [actionLimit, setActionLimit] = useState(ROW_LIMIT);
  const [stateLimit, setStateLimit] = useState(ROW_LIMIT);

  const pagesById = useMemo(
    () => new Map((pages.data ?? []).map((p) => [p.id, p] as const)),
    [pages.data],
  );
  const actionsByPage = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of actions.data ?? []) {
      if (a.page_id) m.set(a.page_id, (m.get(a.page_id) ?? 0) + 1);
    }
    return m;
  }, [actions.data]);
  const actionsSorted = useMemo(
    () => [...(actions.data ?? [])].sort((a, b) => parseTs(a.created_at) - parseTs(b.created_at)),
    [actions.data],
  );
  const statesSorted = useMemo(
    () => [...(states.data ?? [])].sort((a, b) => parseTs(a.created_at) - parseTs(b.created_at)),
    [states.data],
  );
  const failuresSorted = useMemo(
    () =>
      [...(failures.data ?? [])].sort(
        (a, b) => sevRank(a.severity) - sevRank(b.severity) || parseTs(b.created_at) - parseTs(a.created_at),
      ),
    [failures.data],
  );

  const r = run.data;

  if (!r) {
    return (
      <div className="ct-page">
        <nav className="ct-crumbs">
          <Link to={paths.projects}>Projects</Link>
        </nav>
        {run.error ? (
          <ErrorState what="run" message={run.error} onRetry={() => run.reload()} />
        ) : (
          <section className="ct-panel" aria-busy="true">
            <SkeletonRows rows={6} />
          </section>
        )}
      </div>
    );
  }

  const projectName = project.data?.name ?? shortId(r.project_id);
  const tab: Tab = tabState ?? (failuresSorted.length > 0 ? 'failures' : 'actions');
  const failureCount = failures.data?.length;
  const count = (n: number | undefined) => (n === undefined ? '\u2014' : n);

  const TABS: { id: Tab; label: string; n: number | undefined }[] = [
    { id: 'failures', label: 'Failures', n: failureCount },
    { id: 'actions', label: 'Actions', n: actions.data?.length },
    { id: 'pages', label: 'Pages', n: pages.data?.length },
    { id: 'states', label: 'DOM states', n: states.data?.length },
  ];

  return (
    <div className="ct-page">
      <nav className="ct-crumbs" aria-label="Breadcrumb">
        <Link to={paths.projects}>Projects</Link>
        <span aria-hidden="true">/</span>
        <Link to={paths.project(r.project_id)}>{projectName}</Link>
        <span aria-hidden="true">/</span>
        <span className="ct-mono">Run {shortId(r.id)}</span>
      </nav>

      <header className="ct-pagehead">
        <div className="ct-head-main">
          <div className="ct-titlerow">
            <h1 className="ct-title">
              Run <span className="ct-mono">{shortId(r.id)}</span>
            </h1>
            <StatusBadge status={r.status} />
          </div>
          <div className="ct-meta">
            <span>
              <b>Run ID</b>
              <span className="ct-mono ct-wrap">{r.id}</span>
              <CopyButton text={r.id} />
            </span>
            <span>
              <b>Project</b>
              <Link className="ct-link" to={paths.project(r.project_id)}>
                {projectName}
              </Link>
            </span>
            <span>
              <b>Started</b>
              {r.started_at ? formatDateTime(r.started_at) : 'Not started'}
            </span>
            <span>
              <b>Duration</b>
              <span className="ct-mono">{formatDuration(runDurationMs(r, now))}</span>
            </span>
          </div>
        </div>
        <Button icon={<RefreshIcon />} onClick={() => reloadAll()} loading={run.loading}>
          Refresh
        </Button>
      </header>

      {r.status === 'RUNNING' ? (
        <Banner tone="info" icon={<span className="ct-badge ct-tone-info"><span className="ct-dot ct-dot-live" /></span>}>
          Run in progress. Data refreshes every 3 seconds.
        </Banner>
      ) : null}
      {r.status === 'PENDING' ? (
        <Banner tone="info" icon={<span className="ct-badge ct-tone-neutral"><span className="ct-dot" /></span>}>
          Run is queued and has not started yet.
        </Banner>
      ) : null}
      {r.status === 'FAILED' ? (
        <Banner tone="bad">
          <strong>Run failed</strong>
          <div className="ct-mono ct-wrap ct-muted">{r.error_message ?? 'No error message was recorded.'}</div>
        </Banner>
      ) : null}
      {r.status === 'STOPPED' ? (
        <Banner tone="warn">
          This run was stopped before it finished. The data below reflects what was captured up to that point.
        </Banner>
      ) : null}
      {run.error ? (
        <ErrorState what="latest run status" message={run.error} onRetry={() => run.reload()} />
      ) : null}

      <div className="ct-metrics" style={{ ['--cols' as string]: 5 }}>
        <Metric label="Pages visited" value={count(pages.data?.length)} />
        <Metric label="DOM states" value={count(states.data?.length)} />
        <Metric label="Actions" value={count(actions.data?.length)} />
        <Metric label="Failures" value={count(failureCount)} bad={(failureCount ?? 0) > 0} />
        <Metric
          label="Duration"
          value={formatDuration(runDurationMs(r, now))}
          hint={r.status === 'RUNNING' ? 'Elapsed' : undefined}
        />
      </div>

      <section className="ct-panel" aria-label="Run data">
        <div className="ct-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              className="ct-tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              <span className={`ct-tab-count${t.id === 'failures' && (t.n ?? 0) > 0 ? ' is-bad' : ''}`}>
                {t.n ?? '\u2014'}
              </span>
            </button>
          ))}
        </div>

        {tab === 'failures' ? (
          <Section
            q={failures}
            items={failuresSorted}
            what="failures"
            empty={<EmptyState title="No failures detected" description={failuresEmpty(r.status)} />}
          >
            {(items) => (
              <div>
                {items.map((f) => (
                  <FailureRow
                    key={f.id}
                    failure={f}
                    pageUrl={f.page_id ? pagesById.get(f.page_id)?.url : undefined}
                  />
                ))}
              </div>
            )}
          </Section>
        ) : null}

        {tab === 'actions' ? (
          <Section
            q={actions}
            items={actionsSorted}
            what="actions"
            empty={
              <EmptyState
                title="No actions recorded"
                description={
                  active
                    ? 'Actions will appear here as the run performs them.'
                    : 'This run did not record any actions.'
                }
              />
            }
          >
            {(items) => (
              <>
                <div className="ct-tablewrap">
                  <table className="ct-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Action</th>
                        <th>Target</th>
                        <th>Value</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.slice(0, actionLimit).map((a) => (
                        <Fragment key={a.id}>
                          <tr className={a.error_message ? 'ct-has-sub' : undefined}>
                            <td data-label="Time" className="ct-mono" title={formatDateTime(a.created_at)}>
                              {formatTime(a.created_at)}
                            </td>
                            <td data-label="Action" className="ct-mono">
                              {a.action_type}
                            </td>
                            <td data-label="Target">
                              {a.target_selector ? (
                                <span className="ct-mono ct-wrap">{a.target_selector}</span>
                              ) : (
                                <span className="ct-faint">{'\u2014'}</span>
                              )}
                            </td>
                            <td data-label="Value">
                              {a.value ? (
                                <span className="ct-mono ct-wrap">{a.value}</span>
                              ) : (
                                <span className="ct-faint">{'\u2014'}</span>
                              )}
                            </td>
                            <td data-label="Status">
                              <StatusBadge status={a.status} />
                            </td>
                          </tr>
                          {a.error_message ? (
                            <tr className="ct-subrow">
                              <td colSpan={5}>
                                <span className="ct-mono ct-wrap ct-bad-text">{a.error_message}</span>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ShowMore
                  shown={Math.min(actionLimit, items.length)}
                  total={items.length}
                  onMore={() => setActionLimit(items.length)}
                />
              </>
            )}
          </Section>
        ) : null}

        {tab === 'pages' ? (
          <Section
            q={pages}
            items={pages.data ?? []}
            what="pages"
            empty={
              <EmptyState
                title="No pages visited"
                description={active ? 'Pages will appear here as they are crawled.' : 'This run did not visit any pages.'}
              />
            }
          >
            {(items) => (
              <div className="ct-tablewrap">
                <table className="ct-table">
                  <thead>
                    <tr>
                      <th>URL</th>
                      <th>Title</th>
                      <th className="ct-num">Depth</th>
                      <th className="ct-num">Load time</th>
                      <th className="ct-num">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => (
                      <tr key={p.id}>
                        <td className="ct-cell-main">
                          <span className="ct-mono ct-wrap">{p.url}</span>
                        </td>
                        <td data-label="Title">{p.title || <span className="ct-faint">{'\u2014'}</span>}</td>
                        <td data-label="Depth" className="ct-num">
                          {p.depth ?? '\u2014'}
                        </td>
                        <td data-label="Load time" className="ct-num ct-mono">
                          {formatDuration(p.load_time_ms)}
                        </td>
                        <td data-label="Actions" className="ct-num">
                          {actionsByPage.get(p.id) ?? 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        ) : null}

        {tab === 'states' ? (
          <Section
            q={states}
            items={statesSorted}
            what="DOM states"
            empty={
              <EmptyState
                title="No DOM states captured"
                description={
                  active ? 'States will appear here as they are captured.' : 'This run did not capture any DOM states.'
                }
              />
            }
          >
            {(items) => (
              <>
                <div className="ct-tablewrap">
                  <table className="ct-table">
                    <thead>
                      <tr>
                        <th>State</th>
                        <th>DOM hash</th>
                        <th className="ct-num">Elements</th>
                        <th className="ct-num">Selectors</th>
                        <th>Title hint</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.slice(0, stateLimit).map((s, i) => (
                        <StateRow key={s.id} state={s} index={i + 1} />
                      ))}
                    </tbody>
                  </table>
                </div>
                <ShowMore
                  shown={Math.min(stateLimit, items.length)}
                  total={items.length}
                  onMore={() => setStateLimit(items.length)}
                />
              </>
            )}
          </Section>
        ) : null}
      </section>
    </div>
  );
}
