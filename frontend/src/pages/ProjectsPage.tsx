import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import { PlusIcon } from '../components/Icons';
import Modal from '../components/Modal';
import { EmptyState, ErrorState, SkeletonRows } from '../components/States';
import StatusBadge from '../components/StatusBadge';
import { createProject, fetchProjectRuns, listProjects } from '../lib/client';
import { formatDate, formatRelative, newestFirst } from '../lib/format';
import { errMsg, useAsync, useRowClick } from '../lib/hooks';
import { paths } from '../lib/routes';
import type { Project, TestRun } from '../types';

interface ProjectRow {
  project: Project;
  runs: TestRun[] | null;
}

async function loadRows(): Promise<ProjectRow[]> {
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

function normalizeUrl(raw: string): string {
  const v = raw.trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
}

function validate(name: string, url: string): { name?: string; url?: string } {
  const errors: { name?: string; url?: string } = {};
  if (!name.trim()) errors.name = 'Project name is required.';
  if (!url.trim()) {
    errors.url = 'Target URL is required.';
  } else {
    try {
      const u = new URL(normalizeUrl(url));
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocol');
    } catch {
      errors.url = 'Enter a valid http(s) URL.';
    }
  }
  return errors;
}

function NewProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (p: Project) => void;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [objective, setObjective] = useState('');
  const [errors, setErrors] = useState<{ name?: string; url?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next = validate(name, url);
    setErrors(next);
    if (next.name || next.url) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const project = await createProject({
        name: name.trim(),
        url: normalizeUrl(url),
        description: description.trim() || undefined,
        testing_objective: objective.trim() || undefined,
      });
      onCreated(project);
    } catch (err) {
      setSubmitError(errMsg(err));
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New project" onClose={onClose} busy={submitting}>
      <form onSubmit={submit} noValidate>
        <div className="ct-modal-body">
          <div className="ct-field">
            <label className="ct-label" htmlFor="np-name">
              Project name
            </label>
            <input
              id="np-name"
              className="ct-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Storefront"
              aria-invalid={errors.name ? true : undefined}
              disabled={submitting}
              autoComplete="off"
            />
            {errors.name ? <div className="ct-field-error">{errors.name}</div> : null}
          </div>
          <div className="ct-field">
            <label className="ct-label" htmlFor="np-url">
              Target URL
            </label>
            <input
              id="np-url"
              className="ct-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              inputMode="url"
              aria-invalid={errors.url ? true : undefined}
              disabled={submitting}
              autoComplete="off"
            />
            {errors.url ? <div className="ct-field-error">{errors.url}</div> : null}
          </div>
          <div className="ct-field">
            <label className="ct-label" htmlFor="np-desc">
              Description <span className="ct-faint">(optional)</span>
            </label>
            <textarea
              id="np-desc"
              className="ct-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="ct-field">
            <label className="ct-label" htmlFor="np-obj">
              Testing objective <span className="ct-faint">(optional)</span>
            </label>
            <textarea
              id="np-obj"
              className="ct-input"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              disabled={submitting}
            />
          </div>
          {submitError ? (
            <div className="ct-field-error" role="alert" style={{ marginBottom: 12 }}>
              {submitError}
            </div>
          ) : null}
        </div>
        <div className="ct-modal-foot">
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            Create project
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const onRowClick = useRowClick();
  const { data, error, loading, reload } = useAsync(loadRows, []);
  const [creating, setCreating] = useState(false);
  const rows = data ?? [];

  return (
    <div className="ct-page">
      <header className="ct-pagehead">
        <div>
          <h1 className="ct-title">Projects</h1>
          <p className="ct-sub">Websites monitored and tested by AI Chaos Tester.</p>
        </div>
        <Button variant="primary" icon={<PlusIcon />} onClick={() => setCreating(true)}>
          New project
        </Button>
      </header>

      {error ? (
        <ErrorState what="projects" message={error} onRetry={() => reload()} />
      ) : (
        <section className="ct-panel" aria-label="Projects">
          {loading && !data ? (
            <SkeletonRows />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No projects yet"
              description="Add a website to start exploring it for failures."
              action={
                <Button variant="primary" icon={<PlusIcon />} onClick={() => setCreating(true)}>
                  New project
                </Button>
              }
            />
          ) : (
            <div className="ct-tablewrap">
              <table className="ct-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Target</th>
                    <th className="ct-num">Runs</th>
                    <th>Last run</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ project: p, runs }) => {
                    const latest = runs?.[0];
                    const to = paths.project(p.id);
                    return (
                      <tr key={p.id} className="ct-clickable" onClick={(e) => onRowClick(e, to)}>
                        <td className="ct-cell-main">
                          <Link className="ct-link" to={to}>
                            {p.name}
                          </Link>
                          <div className="ct-faint ct-small">Created {formatDate(p.created_at)}</div>
                        </td>
                        <td data-label="Target">
                          <span className="ct-mono ct-wrap">{p.url}</span>
                        </td>
                        <td data-label="Runs" className="ct-num">
                          {runs ? runs.length : '\u2014'}
                        </td>
                        <td data-label="Last run">{latest ? formatRelative(latest.created_at) : '\u2014'}</td>
                        <td data-label="Status">
                          {latest ? (
                            <StatusBadge status={latest.status} />
                          ) : (
                            <span className="ct-faint">{runs ? 'No runs' : '\u2014'}</span>
                          )}
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

      {creating ? (
        <NewProjectModal
          onClose={() => setCreating(false)}
          onCreated={(p) => {
            setCreating(false);
            navigate(paths.project(p.id));
          }}
        />
      ) : null}
    </div>
  );
}