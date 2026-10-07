import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, SkeletonRows } from '../components/States';
import StatusBadge from '../components/StatusBadge';
import { fetchProjectRuns, listProjects } from '../lib/client';
import { formatDateTime, formatDuration, formatRelative, parseTs, runDurationMs, shortId } from '../lib/format';
import { useAsync, useRowClick } from '../lib/hooks';
import { paths } from '../lib/routes';
import type { TestRun } from '../types';

interface RunRow {
  run: TestRun;
  projectId: string;
  projectName: string;
}

async function loadAll(): Promise<RunRow[]> {
  const projects = await listProjects();
  const groups = await Promise.all(
    projects.map(async (p): Promise<RunRow[]> => {
      try {
        const runs = await fetchProjectRuns(p.id);
        return runs.map((run) => ({ run, projectId: p.id, projectName: p.name }));
      } catch {
        return [];
      }
    }),
  );
  return groups.flat().sort((a, b) => parseTs(b.run.created_at) - parseTs(a.run.created_at));
}

export default function RunsPage() {
  const onRowClick = useRowClick();
  const { data, error, loading, reload } = useAsync(loadAll, []);
  const rows = data ?? [];

  return (
    <div className="ct-page">
      <header className="ct-pagehead">
        <div>
          <h1 className="ct-title">Runs</h1>
          <p className="ct-sub">Every test run across all projects, newest first.</p>
        </div>
      </header>

      {error ? (
        <ErrorState what="runs" message={error} onRetry={() => reload()} />
      ) : (
        <section className="ct-panel" aria-label="Runs">
          {loading && !data ? (
            <SkeletonRows />
          ) : rows.length === 0 ? (
            <EmptyState title="No runs yet" description="Start a chaos test from a project page." />
          ) : (
            <div className="ct-tablewrap">
              <table className="ct-table">
                <thead>
                  <tr>
                    <th>Run</th>
                    <th>Project</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ run, projectId, projectName }) => {
                    const to = paths.run(run.id);
                    return (
                      <tr key={run.id} className="ct-clickable" onClick={(e) => onRowClick(e, to)}>
                        <td className="ct-cell-main">
                          <Link className="ct-link ct-mono" to={to} title={run.id}>
                            {shortId(run.id)}
                          </Link>
                        </td>
                        <td data-label="Project">
                          <Link className="ct-link" to={paths.project(projectId)}>
                            {projectName}
                          </Link>
                        </td>
                        <td data-label="Status">
                          <StatusBadge status={run.status} />
                        </td>
                        <td data-label="Created" title={formatDateTime(run.created_at)}>
                          {formatRelative(run.created_at)}
                        </td>
                        <td data-label="Duration" className="ct-mono">
                          {formatDuration(runDurationMs(run))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}