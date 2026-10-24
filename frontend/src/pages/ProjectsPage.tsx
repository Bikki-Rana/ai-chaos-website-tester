import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import ChaosHero from '../components/ChaosHero';
import { PlusIcon } from '../components/Icons';
import NewProjectModal from '../components/NewProjectModal';
import ProjectCard from '../components/ProjectCard';
import type { OrderEntry } from '../components/ProjectActionMenu';
import { EmptyState, ErrorState, SkeletonRows } from '../components/States';
import TiltCard from '../components/TiltCard';
import { useAuth } from '../lib/auth';
import { createProject, fetchProjectRuns, listProjects } from '../lib/client';
import type { ProjectInput, ProjectMeta } from '../lib/client';
import { addDraft, claimDrafts, listDrafts, useDrafts } from '../lib/drafts';
import { onProjectsChanged } from '../lib/events';
import { formatRelative, newestFirst } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { paths } from '../lib/routes';
import { useCountUp } from '../lib/useCountUp';
import type { TestRun } from '../types';

interface ProjectRow {
  project: ProjectMeta;
  runs: TestRun[] | null;
}

async function loadRows(): Promise<ProjectRow[]> {
  // Projects a guest created before signing in are saved to the account first.
  if (listDrafts().length > 0) {
    try {
      await claimDrafts();
    } catch {
      /* they stay on this device and are retried next time */
    }
  }
  const projects = await listProjects();
  return Promise.all(
    projects.map(async (project): Promise<ProjectRow> => {
      try {
        return { project, runs: newestFirst(await fetchProjectRuns(project.id)) };
      } catch {
        return { project, runs: null };
      }
    }),
  );
}

function Stat({
  label,
  value,
  hint,
  bad = false,
  index,
}: {
  label: string;
  value: number;
  hint?: string;
  bad?: boolean;
  index: number;
}) {
  const shown = useCountUp(value);
  return (
    <TiltCard className="ct-stat ct-rise" style={{ ['--i' as string]: index }}>
      <div className="ct-lift">
        <div className="ct-stat-label">{label}</div>
        <div className={`ct-stat-value${bad ? ' is-bad' : ''}`}>{shown}</div>
        {hint ? <div className="ct-stat-hint">{hint}</div> : null}
      </div>
    </TiltCard>
  );
}

export default function ProjectsPage() {
  const { status } = useAuth();
  const authed = status === 'authed';
  const navigate = useNavigate();
  const location = useLocation();
  const drafts = useDrafts();
  const [creating, setCreating] = useState(false);

  const { data, error, loading, reload } = useAsync<ProjectRow[]>(
    () => (authed ? loadRows() : Promise.resolve<ProjectRow[]>([])),
    [authed],
  );
  const rows = useMemo(() => data ?? [], [data]);

  // Rename / pin / move / delete from the menus refresh this list.
  useEffect(() => onProjectsChanged(() => reload(true)), [reload]);

  // The sidebar "New project" button navigates here with this flag.
  useEffect(() => {
    if ((location.state as { newProject?: boolean } | null)?.newProject) {
      setCreating(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  const stats = useMemo(() => {
    let totalRuns = 0;
    let running = 0;
    let attention = 0;
    for (const { runs } of rows) {
      if (!runs) continue;
      totalRuns += runs.length;
      running += runs.filter((r) => r.status === 'RUNNING').length;
      if (runs[0]?.status === 'FAILED') attention += 1;
    }
    return { totalRuns, running, attention };
  }, [rows]);

  const order = useMemo<OrderEntry[]>(
    () => rows.map(({ project }) => ({ id: project.id, pinned: Boolean(project.pinned) })),
    [rows],
  );

  async function createNew(input: ProjectInput): Promise<void> {
    if (authed) {
      const project = await createProject(input);
      navigate(paths.project(project.id));
    } else {
      const draft = addDraft(input);
      navigate(paths.project(draft.id));
    }
  }

  const checking = status === 'loading' || (authed && loading && !data);
  const hasItems = authed ? rows.length > 0 : drafts.length > 0;

  return (
    <div className="ct-page">
      <ChaosHero>
        <h1 className="ct-title ct-hero-title">Projects</h1>
        <p className="ct-sub">Websites monitored and tested by AI Chaos Tester.</p>
        <div className="ct-hero-actions">
          <Button variant="primary" icon={<PlusIcon />} onClick={() => setCreating(true)} disabled={status === 'loading'}>
            New project
          </Button>
        </div>
      </ChaosHero>

      {authed && error ? <ErrorState what="projects" message={error} onRetry={() => reload()} /> : null}

      {checking ? (
        <section className="ct-panel" aria-busy="true">
          <SkeletonRows rows={3} />
        </section>
      ) : !hasItems && !error ? (
        <section className="ct-panel">
          <EmptyState title="No projects yet" description="Add a website to start exploring it for failures." />
        </section>
      ) : null}

      {authed && rows.length > 0 ? (
        <div className="ct-stats">
          <Stat index={0} label="Projects" value={rows.length} />
          <Stat index={1} label="Total runs" value={stats.totalRuns} />
          <Stat index={2} label="Running now" value={stats.running} />
          <Stat index={3} label="Latest run failed" value={stats.attention} bad={stats.attention > 0} hint="Projects" />
        </div>
      ) : null}

      {authed && rows.length > 0 ? (
        <div className="ct-pgrid">
          {rows.map(({ project, runs }, i) => {
            const latest = runs?.[0];
            return (
              <ProjectCard
                key={project.id}
                id={project.id}
                index={i}
                to={paths.project(project.id)}
                name={project.name}
                url={project.url}
                pinned={Boolean(project.pinned)}
                status={latest?.status ?? null}
                runs={runs ? runs.length : null}
                lastRun={latest ? formatRelative(latest.created_at) : undefined}
                order={order}
              />
            );
          })}
        </div>
      ) : null}

      {!authed && status !== 'loading' && drafts.length > 0 ? (
        <div className="ct-pgrid">
          {drafts.map((d, i) => (
            <ProjectCard
              key={d.id}
              id={d.id}
              index={i}
              draft
              to={paths.project(d.id)}
              name={d.name}
              url={d.url}
            />
          ))}
        </div>
      ) : null}

      {creating ? <NewProjectModal onClose={() => setCreating(false)} onSubmit={createNew} /> : null}
    </div>
  );
}